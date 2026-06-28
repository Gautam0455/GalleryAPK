import React, { useState } from 'react';
import {
  TouchableOpacity,
  Image,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import type { Photo } from '../../App';

interface GalleryItemProps {
  photo: Photo;
  size: number;
  onPress: () => void;
}

function GalleryItem({ photo, size, onPress }: GalleryItemProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size }]}
      onPress={onPress}
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
});

export default React.memo(GalleryItem);
