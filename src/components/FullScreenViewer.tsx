import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import type { Photo } from '../../App';

interface FullScreenViewerProps {
  visible: boolean;
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
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

function FullScreenViewer({ visible, photos, initialIndex, onClose }: FullScreenViewerProps) {
  const listRef = useRef<FlatList<Photo>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
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

        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          onScrollToIndexFailed={({ index }) => {
            // Fallback: jump by offset, then retry once layout is ready.
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

        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {current && (
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
      </View>
    </Modal>
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
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
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
});

export default FullScreenViewer;
