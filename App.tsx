import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Dimensions,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GalleryItem from './src/components/GalleryItem';
import FullScreenViewer from './src/components/FullScreenViewer';

export interface Photo {
  id: string;
  uri: string;
  filename: string;
  album: string;
}

export interface AlbumGroup {
  id: string;
  title: string;
  photos: Photo[];
}

const PAGE_SIZE = 100; // fetched per request; all pages are loaded
const CACHE_KEY = 'gallery_cache_v1';
const LAST_SYNC_KEY = 'gallery_last_sync_v1';

const NUM_COLUMNS = 3;
const GAP = 2;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = Math.floor((SCREEN_WIDTH - GAP * 2 * NUM_COLUMNS) / NUM_COLUMNS);

// Flattened list rows: either an album header or a row of up to 3 photos.
type ListRow =
  | { type: 'header'; id: string; title: string; count: number }
  | { type: 'row'; id: string; photos: Photo[]; albumPhotos: Photo[]; baseIndex: number };

export default function App() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [albums, setAlbums] = useState<AlbumGroup[]>([]);
  const [loading, setLoading] = useState(true); // initial cache load
  const [syncing, setSyncing] = useState(false); // active media scan
  const [denied, setDenied] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Scan the device media library and group photos by album (folder).
  const scanDevice = useCallback(async (): Promise<AlbumGroup[]> => {
    const fetched = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });

    const groups: AlbumGroup[] = [];
    for (const album of fetched) {
      if (!album.assetCount) continue;

      // Page through the album to load EVERY photo (no per-folder limit).
      const photos: Photo[] = [];
      let after: string | undefined;
      let hasNextPage = true;
      while (hasNextPage) {
        const result = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: MediaLibrary.MediaType.photo,
          first: PAGE_SIZE,
          after,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        for (const a of result.assets) {
          photos.push({
            id: a.id,
            uri: a.uri,
            filename: a.filename,
            album: album.title,
          });
        }
        after = result.endCursor;
        hasNextPage = result.hasNextPage;
      }

      if (photos.length === 0) continue;
      groups.push({
        id: album.id,
        title: album.title,
        photos,
      });
    }
    groups.sort((a, b) => b.photos.length - a.photos.length);
    return groups;
  }, []);

  // Full sync: request permission, scan, then persist to cache.
  const sync = useCallback(async () => {
    setSyncing(true);
    setDenied(false);
    try {
      const perm = permission?.granted ? permission : await requestPermission();
      if (!perm.granted) {
        setDenied(true);
        return;
      }
      const groups = await scanDevice();
      const now = Date.now();
      setAlbums(groups);
      setLastSync(now);
      await AsyncStorage.multiSet([
        [CACHE_KEY, JSON.stringify(groups)],
        [LAST_SYNC_KEY, String(now)],
      ]);
    } catch (e) {
      console.warn('Sync failed', e);
    } finally {
      setSyncing(false);
    }
  }, [permission, requestPermission, scanDevice]);

  // On launch: load from cache instantly. Only auto-sync the first time.
  const init = useCallback(async () => {
    setLoading(true);
    try {
      const [[, cached], [, lastSyncStr]] = await AsyncStorage.multiGet([
        CACHE_KEY,
        LAST_SYNC_KEY,
      ]);

      if (cached) {
        const groups: AlbumGroup[] = JSON.parse(cached);
        setAlbums(groups);
        setLastSync(lastSyncStr ? Number(lastSyncStr) : null);
        setLoading(false);
        return; // cached -> no automatic re-sync
      }

      // First time ever: sync automatically.
      setLoading(false);
      await sync();
    } catch (e) {
      console.warn('Init failed', e);
      setLoading(false);
    }
  }, [sync]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openViewer = useCallback((photos: Photo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  // ---- Delete handling ----

  // Permanently delete the given asset ids from the device, then update state/cache.
  const deletePhotos = useCallback(async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return false;
    try {
      const perm = permission?.granted ? permission : await requestPermission();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to delete photos.');
        return false;
      }
      const deleted = await MediaLibrary.deleteAssetsAsync(ids);
      if (!deleted) return false;

      const idSet = new Set(ids);
      setAlbums((prev) => {
        const next = prev
          .map((al) => ({ ...al, photos: al.photos.filter((p) => !idSet.has(p.id)) }))
          .filter((al) => al.photos.length > 0);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return true;
    } catch (e) {
      console.warn('Delete failed', e);
      Alert.alert('Delete failed', 'Could not delete the selected photo(s).');
      return false;
    }
  }, [permission, requestPermission]);

  // Show "Are you sure?" popup, then delete on confirm.
  const confirmDelete = useCallback(
    (ids: string[]): Promise<boolean> =>
      new Promise((resolve) => {
        const n = ids.length;
        Alert.alert(
          n > 1 ? `Delete ${n} photos?` : 'Delete photo?',
          `Are you sure? This will permanently delete ${
            n > 1 ? 'these photos' : 'this photo'
          } from your device.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => resolve(await deletePhotos(ids)),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) }
        );
      }),
    [deletePhotos]
  );

  // ---- Selection handling ----

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelected({ [id]: true });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      if (Object.keys(next).length === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected({});
  }, []);

  const selectAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    albums.forEach((al) => al.photos.forEach((p) => (all[p.id] = true)));
    setSelected(all);
    setSelectionMode(true);
  }, [albums]);

  const deleteSelected = useCallback(async () => {
    const ids = Object.keys(selected);
    if (ids.length === 0) return;
    const ok = await confirmDelete(ids);
    if (ok) clearSelection();
  }, [selected, confirmDelete, clearSelection]);

  // Delete a single photo from the full-screen viewer.
  const handleViewerDelete = useCallback(
    async (id: string): Promise<boolean> => {
      const ok = await confirmDelete([id]);
      if (ok) {
        setViewerPhotos((prev) => {
          const next = prev.filter((p) => p.id !== id);
          if (next.length === 0) setViewerOpen(false);
          return next;
        });
      }
      return ok;
    },
    [confirmDelete]
  );

  // Build the flattened, virtualization-friendly list once per albums change.
  const listData = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    for (const album of albums) {
      rows.push({
        type: 'header',
        id: `h_${album.id}`,
        title: album.title,
        count: album.photos.length,
      });
      for (let i = 0; i < album.photos.length; i += NUM_COLUMNS) {
        rows.push({
          type: 'row',
          id: `${album.id}_${i}`,
          photos: album.photos.slice(i, i + NUM_COLUMNS),
          albumPhotos: album.photos,
          baseIndex: i,
        });
      }
    }
    return rows;
  }, [albums]);

  const totalPhotos = useMemo(
    () => albums.reduce((sum, a) => sum + a.photos.length, 0),
    [albums]
  );

  const selectedCount = Object.keys(selected).length;

  const renderRow = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.albumTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.albumCount}>{item.count}</Text>
          </View>
        );
      }
      return (
        <View style={styles.row}>
          {item.photos.map((photo, j) => (
            <GalleryItem
              key={photo.id}
              photo={photo}
              size={ITEM_SIZE}
              selectionMode={selectionMode}
              selected={!!selected[photo.id]}
              onPress={() => {
                if (selectionMode) toggleSelect(photo.id);
                else openViewer(item.albumPhotos, item.baseIndex + j);
              }}
              onLongPress={() => enterSelection(photo.id)}
            />
          ))}
        </View>
      );
    },
    [openViewer, selectionMode, selected, toggleSelect, enterSelection]
  );

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString()
    : 'Never synced';

  // Initial cache load spinner.
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.centerText}>Loading your gallery…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (denied) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.centerTitle}>Photo access needed</Text>
          <Text style={styles.centerText}>
            Allow access to your photos so the gallery can sync and display them.
          </Text>
          <TouchableOpacity style={styles.button} onPress={sync}>
            <Text style={styles.buttonText}>Grant & Sync</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {selectionMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={clearSelection} hitSlop={12}>
            <Text style={styles.headerIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.selCount}>{selectedCount} selected</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={selectAll} hitSlop={12} style={styles.headerBtn}>
              <Text style={styles.headerAction}>Select all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deleteSelected}
              hitSlop={12}
              style={styles.headerBtn}
              disabled={selectedCount === 0}
            >
              <Text style={[styles.headerAction, styles.deleteAction]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Gallery</Text>
            <Text style={styles.headerSub}>
              {totalPhotos} photos · {lastSyncLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={sync}
            disabled={syncing}
            activeOpacity={0.8}
          >
            {syncing ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.syncText}>Syncing…</Text>
              </>
            ) : (
              <Text style={styles.syncText}>↻ Sync</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {albums.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.centerText}>No photos found on this device</Text>
          <TouchableOpacity style={styles.button} onPress={sync} disabled={syncing}>
            <Text style={styles.buttonText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderRow}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <FullScreenViewer
        visible={viewerOpen}
        photos={viewerPhotos}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onRequestDelete={handleViewerDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  centerText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  emoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerLeft: {
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  headerIcon: {
    fontSize: 22,
    color: '#111',
    fontWeight: '600',
  },
  selCount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    marginLeft: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    marginLeft: 18,
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  deleteAction: {
    color: '#FF3B30',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginLeft: 12,
  },
  syncButtonDisabled: {
    backgroundColor: '#6db1ff',
  },
  syncText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
  },
  albumTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginRight: 8,
    flexShrink: 1,
  },
  albumCount: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
});
