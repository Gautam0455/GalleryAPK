import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import type { Photo } from '../../App';

interface FullScreenViewerProps {
  visible: boolean;
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onRequestDelete: (id: string) => Promise<boolean>;
}

const { width, height } = Dimensions.get('window');

function PhotoPage({ uri }: { uri: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.page}>
      {!loaded && !failed && (
        <ActivityIndicator style={styles.pageLoader} size="large" color="#fff" />
      )}
      {failed ? (
        <Text style={styles.error}>Unable to load image</Text>
      ) : (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

interface InfoData {
  filename: string;
  album: string;
  width?: number;
  height?: number;
  creationTime?: number;
  modificationTime?: number;
  uri?: string;
}

function formatDate(ms?: number) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

function FullScreenViewer({
  visible,
  photos,
  initialIndex,
  onClose,
  onRequestDelete,
}: FullScreenViewerProps) {
  const listRef = useRef<FlatList<Photo>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [info, setInfo] = useState<InfoData | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setMenuOpen(false);
      setInfoOpen(false);
    }
  }, [visible, initialIndex]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    []
  );

  const current = photos[currentIndex];

  const openInfo = useCallback(async () => {
    setMenuOpen(false);
    if (!current) return;
    try {
      const asset = await MediaLibrary.getAssetInfoAsync(current.id);
      setInfo({
        filename: current.filename,
        album: current.album,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
        modificationTime: asset.modificationTime,
        uri: asset.localUri || asset.uri,
      });
    } catch {
      setInfo({ filename: current.filename, album: current.album, uri: current.uri });
    }
    setInfoOpen(true);
  }, [current]);

  const onDeletePress = useCallback(async () => {
    setMenuOpen(false);
    if (!current) return;
    await onRequestDelete(current.id);
  }, [current, onRequestDelete]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar hidden />

        {photos.length > 0 && (
          <FlatList
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(initialIndex, Math.max(0, photos.length - 1))}
            getItemLayout={getItemLayout}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            onScrollToIndexFailed={({ index }) => {
              listRef.current?.scrollToOffset({ offset: index * width, animated: false });
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: false });
              }, 100);
            }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentIndex(idx);
            }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PhotoPage uri={item.uri} />}
          />
        )}

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} hitSlop={12}>
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMenuOpen((m) => !m)}
            hitSlop={12}
          >
            <Text style={styles.iconText}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* 3-dot dropdown menu */}
        {menuOpen && (
          <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
            <View style={styles.menuOverlay}>
              <View style={styles.menu}>
                <TouchableOpacity style={styles.menuItem} onPress={openInfo}>
                  <Text style={styles.menuText}>ⓘ  Photo information</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={onDeletePress}>
                  <Text style={[styles.menuText, styles.menuDelete]}>🗑  Delete photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        )}

        {current && !menuOpen && (
          <View style={styles.footer}>
            <Text style={styles.counter}>
              {currentIndex + 1} / {photos.length}
            </Text>
            <Text style={styles.album}>{current.album}</Text>
            <Text style={styles.filename} numberOfLines={1}>
              {current.filename}
            </Text>
          </View>
        )}

        {/* Photo info modal */}
        <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
          <TouchableWithoutFeedback onPress={() => setInfoOpen(false)}>
            <View style={styles.infoBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Photo information</Text>
                  <ScrollView>
                    <InfoRow label="Name" value={info?.filename || '—'} />
                    <InfoRow label="Folder" value={info?.album || '—'} />
                    <InfoRow
                      label="Dimensions"
                      value={info?.width && info?.height ? `${info.width} × ${info.height}` : '—'}
                    />
                    <InfoRow label="Date taken" value={formatDate(info?.creationTime)} />
                    <InfoRow label="Modified" value={formatDate(info?.modificationTime)} />
                    <InfoRow label="Path" value={info?.uri || '—'} />
                  </ScrollView>
                  <TouchableOpacity style={styles.infoClose} onPress={() => setInfoOpen(false)}>
                    <Text style={styles.infoCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageLoader: {
    position: 'absolute',
  },
  image: {
    width,
    height: height * 0.85,
  },
  error: {
    color: '#bbb',
    fontSize: 14,
  },
  topBar: {
    position: 'absolute',
    top: 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: 'absolute',
    top: 82,
    right: 16,
    minWidth: 210,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 15,
    color: '#111',
    fontWeight: '600',
  },
  menuDelete: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e3e3e3',
    marginHorizontal: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  counter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  album: {
    color: '#4da3ff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  filename: {
    color: '#ccc',
    fontSize: 12,
    maxWidth: '90%',
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 14,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#111',
  },
  infoClose: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  infoCloseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default FullScreenViewer;
