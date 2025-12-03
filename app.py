import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import base64
import matplotlib.cm as cm

app = Flask(__name__)
CORS(app)

MODEL_PATH = 'zambali_rice_efficientnet.h5' 
LAST_CONV_LAYER_NAME = 'top_activation' 

LABELS = [
    'Bacterial Leaf Blight', 
    'Brown Spot', 
    'Healthy Rice Leaf', 
    'Leaf Blast', 
    'Leaf Scald', 
    'NOT_A_RICE_LEAF',
    'Sheath Blight'
]

# --- 1. GLOBAL VARIABLE (Start as None) ---
model = None

# --- 2. LAZY LOADING FUNCTION ---
def get_model():
    global model
    if model is None:
        print("⏳ Loading model for the first time...")
        # This will only run when the first user scans a leaf
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded successfully!")
    return model

# --- 3. GRAD-CAM FUNCTIONS ---
def get_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=None):
    grad_model = tf.keras.models.Model(
        [model.inputs], [model.get_layer(last_conv_layer_name).output, model.output]
    )
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    return heatmap.numpy()

def generate_heatmap_image(img_array, heatmap, alpha=0.75):
    heatmap = np.uint8(255 * heatmap)
    jet = cm.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[heatmap]

    jet_heatmap = tf.keras.utils.array_to_img(jet_heatmap)
    jet_heatmap = jet_heatmap.resize((img_array.shape[1], img_array.shape[0]))
    jet_heatmap = tf.keras.utils.img_to_array(jet_heatmap)

    superimposed_img = jet_heatmap * alpha + img_array * (1 - alpha)
    superimposed_img = tf.keras.utils.array_to_img(superimposed_img)
    return superimposed_img

# --- 4. HEALTH CHECK ROUTE (Crucial for Render) ---
@app.route('/', methods=['GET'])
def home():
    return "Rice Doctor API is Running! Send POST requests to /predict"

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    
    # 1. Open Image
    img = Image.open(file.stream).convert('RGB')
    
    # 2. SQUASHING METHOD (Option A)
    img = img.resize((224, 224))
    
    # 3. Convert to Array
    img_array = tf.keras.utils.img_to_array(img)
    
    # 4. Prepare Batch
    img_batch = np.expand_dims(img_array, axis=0) 

    # --- 5. GET MODEL (Lazy Load) ---
    # We call the function here. If it's the first time, it loads.
    # If it's the second time, it's instant.
    current_model = get_model()

    # 6. Prediction
    preds = current_model.predict(img_batch)
    pred_idx = np.argmax(preds[0])
    confidence = float(preds[0][pred_idx])
    label = LABELS[pred_idx]

    # 7. Generate Grad-CAM
    try:
        # Pass 'current_model', not the global 'model'
        heatmap = get_gradcam_heatmap(img_batch, current_model, LAST_CONV_LAYER_NAME, pred_idx)
        result_img = generate_heatmap_image(img_array, heatmap)

        buffered = io.BytesIO()
        result_img.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"⚠️ Grad-CAM failed: {e}")
        img_str = "" 

    return jsonify({
        'label': label,
        'confidence': f"{confidence:.2%}",
        'heatmap_image': img_str
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)