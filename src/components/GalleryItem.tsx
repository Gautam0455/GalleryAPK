import React, { useState } from 'react';
import {
  TouchableOpacity,
  Image,
  StyleSheet,
  View,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import type { Photo } from '../../App';

interface GalleryItemProps {
  photo: Photo;
  onPress: () => void;
}

const NUM_COLUMNS = 3;
const GAP = 2;
const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - GAP * 2 * NUM_COLUMNS) / NUM_COLUMNS;

function GalleryItem({ photo, onPress }: GalleryItemProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.image}
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
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP,
    borderRadius: 6,
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
