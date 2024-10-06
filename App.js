import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as MediaLibrary from 'expo-media-library';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';


const Stack = createStackNavigator();

// const createAlbums = async () => {
//   const albumNames = ['SuperLikedPhotos', 'LikedPhotos', 'ToDelete'];

//   for (const name of albumNames) {
//     const existingAlbum = await MediaLibrary.getAlbumAsync(name);
//     console.log(existingAlbum)
//     if (!existingAlbum) {
//       // Load the dummy asset
//       console.log("first")
//       const dummyImage = Asset.fromModule(require('./blackscreen.jpeg'));
//       await dummyImage.downloadAsync();

//       // Create the asset from the URI
//       const asset = await MediaLibrary.createAssetAsync(dummyImage.uri);
//       console.log(asset)

//       // Create the album
//       await MediaLibrary.createAlbumAsync(name, [asset], false);
//       console.log(`Created album: ${name}`);
//     } else {
//       console.log(`Album already exists: ${name}`);
//     }
//   }
// };

const AlbumListScreen = ({ navigation }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access media library was denied');
        setLoading(false);
        return;
      }

      const albums = await MediaLibrary.getAlbumsAsync();
      const albumsWithCount = await Promise.all(
        albums.map(async (album) => {
          const assets = await MediaLibrary.getAssetsAsync({ album: album.id });
          return { ...album, assetCount: assets.totalCount };
        })
      );
      albumsWithCount.sort((a, b) => b.assetCount - a.assetCount);
      setAlbums(albumsWithCount);
      setLoading(false);
    })();
  }, []);

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity
      style={styles.albumItem}
      onPress={() => navigation.navigate('Photos', { albumId: item.id, title: item.title })}
    >
      <Text style={styles.albumTitle}>{item.title}</Text>
      <Text style={styles.albumCount}>{item.assetCount} photos</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading albums...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={albums}
        renderItem={renderAlbumItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

const PhotosScreen = ({ route }) => {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const { albumId } = route.params;

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access media library was denied');
        setLoading(false);
        return;
      }
      setPermissionGranted(true);

      const assets = await MediaLibrary.getAssetsAsync({
        album: albumId,
        mediaType: 'photo',
        first: 1000,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      // setPhotos(assets.assets);
      const finalassets = assets.assets;
      // console.log(finalassets)
      setPhotos(finalassets);

      setLoading(false);
    })();
  }, [albumId]);

  const moveToNextPhoto = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setImageLoading(true);
    }
  };

  const handleSwipe = async (direction) => {
    if (!permissionGranted) {
      console.log('Permission not granted to manage photos');
      return;
    }

    const currentPhoto = photos[currentIndex];
    let targetAlbum;

    switch (direction) {
      case 'right':
        targetAlbum = 'LikedPhotos';
        break;
      case 'up':
        targetAlbum = 'SuperLikedPhotos';
        break;
      case 'down':
        targetAlbum = 'ToDelete';
        break;
      case 'left':
        moveToNextPhoto();
        return;
    }

    if (!currentPhoto) {
      console.error('No photo available to manage.');
      return;
    }

    try {
      let album = await MediaLibrary.getAlbumAsync(targetAlbum);

      if (!album) {
        console.log(`Album "${targetAlbum}" not found. Creating it...`);
        if (targetAlbum === 'ToDelete') {
          album = await MediaLibrary.createAlbumAsync(targetAlbum, currentPhoto, false);
        }
        else {
          album = await MediaLibrary.createAlbumAsync(targetAlbum, currentPhoto);
        }
        if (!album) {
          throw new Error('Failed to create the album.');
        }
        console.log(`Album "${targetAlbum}" created.`);
      }
      else {
        // Copy the asset to the target album
        if (targetAlbum === 'ToDelete') {
          await MediaLibrary.addAssetsToAlbumAsync([currentPhoto], album, false);
          console.log("Moved")
        }
        else {
          await MediaLibrary.addAssetsToAlbumAsync([currentPhoto], album);
        }
        console.log(`Photo copied to "${targetAlbum}" album`);
      }
    } catch (error) {
      console.error('Error managing photo:', error);
    }

    moveToNextPhoto();
  };


  const gesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, translationY } = event;
      const threshold = 50;

      if (Math.abs(translationX) > Math.abs(translationY)) {
        if (translationX > threshold) {
          handleSwipe('right');
        } else if (translationX < -threshold) {
          handleSwipe('left');
        }
      } else {
        if (translationY > threshold) {
          handleSwipe('down');
        } else if (translationY < -threshold) {
          handleSwipe('up');
        }
      }
    });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading photos...</Text>
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.container}>
        <Text>No photos found in this album.</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={styles.container}>
          {imageLoading && (
            <View style={[styles.loadingContainer, styles.imageLoadingContainer]}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text>Loading image...</Text>
            </View>
          )}
          <Image
            source={{ uri: photos[currentIndex].uri }}
            style={styles.photo}
            resizeMode="contain"
            onLoad={() => setImageLoading(false)}
          />
          <Text style={styles.photoInfo}>
            Photo {currentIndex + 1} of {photos.length}
          </Text>
          <Text style={styles.swipeInstructions}>
            Swipe right: Like | Swipe up: Super Like
            Swipe left: Skip | Swipe down: Mark for deletion
          </Text>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const App = () => {

  // useEffect(() => {
  //   createAlbums()
  // }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Albums" component={AlbumListScreen} />
          <Stack.Screen
            name="Photos"
            component={PhotosScreen}
            options={({ route }) => ({ title: route.params.title })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   imageLoadingContainer: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: 'rgba(255, 255, 255, 0.8)',
//     zIndex: 1,
//   },
//   albumItem: {
//     padding: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#ccc',
//   },
//   albumTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   albumCount: {
//     fontSize: 14,
//     color: '#666',
//   },
//   photo: {
//     flex: 1,
//     width: '100%',
//     height: '100%',
//   },
//   photoInfo: {
//     position: 'absolute',
//     bottom: 60,
//     alignSelf: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     color: '#fff',
//     padding: 5,
//     borderRadius: 5,
//   },
//   swipeInstructions: {
//     position: 'absolute',
//     bottom: 20,
//     alignSelf: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     color: '#fff',
//     padding: 5,
//     borderRadius: 5,
//     textAlign: 'center',
//   },
// });
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', // Light background for a fresh look
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  albumItem: {
    padding: 20,
    marginVertical: 10,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  albumTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  albumCount: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  photo: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoInfo: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  swipeInstructions: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
});


export default App;