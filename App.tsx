import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Platform,
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

  const openViewer = (photos: Photo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const totalPhotos = albums.reduce((sum, a) => sum + a.photos.length, 0);

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

      {albums.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.centerText}>No photos found on this device</Text>
          <TouchableOpacity style={styles.button} onPress={sync} disabled={syncing}>
            <Text style={styles.buttonText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {albums.map((album) => (
            <View key={album.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.albumTitle}>{album.title}</Text>
                <Text style={styles.albumCount}>{album.photos.length}</Text>
              </View>
              <View style={styles.grid}>
                {album.photos.map((photo, index) => (
                  <GalleryItem
                    key={photo.id}
                    photo={photo}
                    onPress={() => openViewer(album.photos, index)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <FullScreenViewer
        visible={viewerOpen}
        photos={viewerPhotos}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
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
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  albumTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginRight: 8,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 2,
  },
});
