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
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
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

const ASSETS_PER_ALBUM = 80;

export default function App() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [albums, setAlbums] = useState<AlbumGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);

  const [viewerPhotos, setViewerPhotos] = useState<Photo[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const loadAlbums = useCallback(async () => {
    try {
      const fetched = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });

      const groups: AlbumGroup[] = [];
      for (const album of fetched) {
        if (!album.assetCount) continue;
        const result = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: MediaLibrary.MediaType.photo,
          first: ASSETS_PER_ALBUM,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        if (result.assets.length === 0) continue;
        groups.push({
          id: album.id,
          title: album.title,
          photos: result.assets.map((a) => ({
            id: a.id,
            uri: a.uri,
            filename: a.filename,
            album: album.title,
          })),
        });
      }
      groups.sort((a, b) => b.photos.length - a.photos.length);
      setAlbums(groups);
    } catch (e) {
      console.warn('Failed to load albums', e);
    }
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    const perm = permission?.granted ? permission : await requestPermission();
    if (!perm.granted) {
      setDenied(true);
      setLoading(false);
      return;
    }
    await loadAlbums();
    setLoading(false);
  }, [permission, requestPermission, loadAlbums]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlbums();
    setRefreshing(false);
  }, [loadAlbums]);

  const openViewer = (photos: Photo[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const totalPhotos = albums.reduce((sum, a) => sum + a.photos.length, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.centerText}>Loading your photos…</Text>
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
            Allow access to your photos so the gallery can display them.
          </Text>
          <TouchableOpacity style={styles.button} onPress={init}>
            <Text style={styles.buttonText}>Grant permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerCount}>{totalPhotos} photos</Text>
      </View>

      {albums.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>📷</Text>
          <Text style={styles.centerText}>No photos found on this device</Text>
          <TouchableOpacity style={styles.button} onPress={onRefresh}>
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
          }
        >
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },
  headerCount: {
    fontSize: 14,
    color: '#999',
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
