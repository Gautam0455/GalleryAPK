import React, { useState } from 'react';
import {
  TouchableOpacity,
  Image,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import type { Photo } from '../../App';

interface GalleryItemProps {
  photo: Photo;
  size: number;
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function GalleryItem({
  photo,
  size,
  selectionMode,
  selected,
  onPress,
  onLongPress,
}: GalleryItemProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.image}
        resizeMode="cover"
        onLoadEnd={() => setLoaded(true)}
      />
      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#bbb" />
        </View>
      )}

      {selected && <View style={styles.selectedOverlay} />}

      {selectionMode && (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,122,255,0.35)',
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 4,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: {
    backgroundColor: '#007AFF',
  },
  checkMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});

export default React.memo(GalleryItem);
