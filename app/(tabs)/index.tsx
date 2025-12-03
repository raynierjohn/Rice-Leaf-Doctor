import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// --- THEME COLORS ---
const COLORS = {
  primary: '#2E7D32',    // Deep Rice Green
  secondary: '#E8F5E9',  // Light Green Background
  accent: '#F57C00',     // Orange for Advice
  danger: '#C62828',     // Red for Disease Name
  text: '#1F2937',       // Dark Grey for readability
  white: '#FFFFFF',
  shadow: '#000',
};

// --- ADVICE DATABASE ---
const DISEASE_ADVICE: { [key: string]: string } = {
  'Bacterial Leaf Blight': '⚠️ Treatment: Use copper-based sprays (e.g., Copper oxychloride). Avoid excessive Nitrogen fertilizer. Ensure good field drainage.',
  'Brown Spot': '⚠️ Treatment: Improve soil fertility, specifically Potassium and Calcium. Treat seeds with fungicides before planting.',
  'Leaf Blast': '⚠️ Treatment: Apply fungicides like Tricyclazole or Isoprothiolane. Maintain water level in the field and avoid late planting.',
  'Leaf Scald': '⚠️ Treatment: Use clean, disease-free seeds. Avoid high Nitrogen application. Apply validamycin if severe.',
  'Sheath Blight': '⚠️ Treatment: Apply fungicides like Azoxystrobin or Hexaconazole. Reduce plant density for better air circulation.',
  'Healthy Rice Leaf': '✅ Good News: Your crop looks healthy! Continue monitoring water levels and nutrient management.',
  'NOT_A_RICE_LEAF': '❓ Unknown: This does not look like a rice leaf. Please try again with a clearer photo close to the leaf.',
};

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ⚠️ ENSURE THIS IP MATCHES YOUR COMPUTER'S CURRENT IP
const API_URL = 'http://172.23.179.96:5000/predict';

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      setResultImage(null);
      setPrediction(null);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // ✅ Recommended: Frontend Cropping
      aspect: [1, 1],
      quality: 1,
    });
    handleImageResult(result);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Refused", "You need to allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // ✅ Recommended: Frontend Cropping
      aspect: [1, 1],
      quality: 1,
    });
    handleImageResult(result);
  };

  const uploadImage = async () => {
    if (!selectedImage) return;

    setLoading(true);
    const formData = new FormData();
    
    formData.append('image', {
      uri: selectedImage,
      name: 'rice_leaf.jpg',
      type: 'image/jpeg',
    } as any);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();
      setPrediction(data);
      setResultImage(`data:image/jpeg;base64,${data.heatmap_image}`);

      addToHistory(data, selectedImage); 

    } catch (error) {
      console.error(error);
      Alert.alert('Connection Error', 'Check your IP address and ensure the Python server is running.');
    } finally {
      setLoading(false);
    }
  };

  const addToHistory = async (predictionData: any, imageUri: string) => {
    try {
      const newEntry = {
        id: Date.now().toString(), // Unique ID
        label: predictionData.label,
        confidence: predictionData.confidence,
        imageUri: imageUri,
        date: new Date().toLocaleString(),
        advice: DISEASE_ADVICE[predictionData.label] || "Consult an expert."
      };

      const existingHistory = await AsyncStorage.getItem('leaf_history');
      const historyArray = existingHistory ? JSON.parse(existingHistory) : [];

      const updatedHistory = [newEntry, ...historyArray];

      await AsyncStorage.setItem('leaf_history', JSON.stringify(updatedHistory.slice(0, 20)));
      console.log("✅ Saved to history");
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* --- HEADER --- */}
      <View style={styles.headerContainer}>
        <MaterialIcons name="grass" size={32} color={COLORS.white} />
        <Text style={styles.headerTitle}>Rice Leaf Doctor</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- WELCOME CARD --- */}
        {!selectedImage && !prediction && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Scan Your Crop</Text>
            <Text style={styles.welcomeText}>
              Take a photo of a rice leaf to detect diseases and get treatment advice instantly.
            </Text>
          </View>
        )}

        {/* --- IMAGE SELECTION BUTTONS --- */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Ionicons name="images" size={28} color={COLORS.primary} />
            <Text style={styles.actionText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color={COLORS.primary} />
            <Text style={styles.actionText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* --- SELECTED IMAGE PREVIEW --- */}
        {selectedImage && (
          <View style={styles.imageCard}>
            <Text style={styles.sectionLabel}>Original Photo</Text>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            
            {/* ANALYZE BUTTON (Only shows when image is selected) */}
            <TouchableOpacity 
              style={styles.analyzeButton} 
              onPress={uploadImage}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="search" size={24} color={COLORS.white} />
                  <Text style={styles.analyzeButtonText}>Diagnose Disease</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* --- RESULTS SECTION --- */}
        {prediction && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Diagnosis Result</Text>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>{prediction.confidence}</Text>
              </View>
            </View>

            <Text style={styles.diseaseName}>{prediction.label}</Text>

            {/* ADVICE BOX */}
            <View style={styles.adviceBox}>
              <Ionicons name="bulb" size={24} color={COLORS.accent} style={{marginBottom: 5}}/>
              <Text style={styles.adviceText}>
                {DISEASE_ADVICE[prediction.label] || "Please consult an agricultural expert."}
              </Text>
            </View>

            {/* HEATMAP */}
            {resultImage && (
              <View style={styles.heatmapContainer}>
                <Text style={styles.sectionLabel}>Heatmap Analysis</Text>
                <Image source={{ uri: resultImage }} style={styles.heatmapImage} />
                <Text style={styles.heatmapCaption}>
                  The colored areas indicate where the model detected the disease.
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Spacer for bottom scrolling */}
        <View style={{height: 50}} />
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA', 
  },
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  
  welcomeCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 15,
    width: '100%',
    marginBottom: 20,
    elevation: 2,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: COLORS.white,
    width: '48%',
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },

  imageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  previewImage: {
    width: width - 80, 
    height: width - 80,
    borderRadius: 10,
    backgroundColor: '#eee',
    resizeMode: 'cover',
  },
  analyzeButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 20,
    width: '100%',
    elevation: 5,
  },
  analyzeButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  resultCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 20,
    width: '100%',
    elevation: 4,
    borderTopWidth: 5,
    borderTopColor: COLORS.primary,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  confidenceBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  diseaseName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 15,
  },

  adviceBox: {
    backgroundColor: '#FFF3E0', 
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    marginBottom: 20,
  },
  adviceText: {
    fontSize: 15,
    color: '#5D4037', 
    lineHeight: 22,
  },

  heatmapContainer: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  heatmapImage: {
    width: width - 90,
    height: width - 90,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  heatmapCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});