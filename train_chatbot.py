"""
Katambay-AI — Offline LSTM Chatbot Training Script
Trains a dengue/AEDE-specific intent classification model and exports to TFLite.

Requirements:
  pip install tensorflow numpy scikit-learn

Run:
  python train_chatbot.py

Outputs:
  assets/models/chatbot.tflite
  assets/models/intents.json
  assets/models/tokenizer_config.json
"""

import json
import os
import re
import string
import numpy as np

try:
    import tensorflow as tf
    from tensorflow import keras
    from sklearn.preprocessing import LabelEncoder
    print(f"[✓] TensorFlow {tf.__version__} loaded.")
except ImportError:
    print("[✗] TensorFlow not found. Run: pip install tensorflow scikit-learn")
    exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Training Dataset — Dengue / AEDE / Katambay-AI Q&A (Filipino + English)
# ─────────────────────────────────────────────────────────────────────────────

INTENTS = [
    {
        "tag": "greeting",
        "patterns": [
            "hello", "hi", "hey", "kumusta", "magandang umaga", "magandang hapon",
            "magandang gabi", "good morning", "good afternoon", "good evening",
            "kamusta", "hello katambay", "hi AI", "hey system"
        ],
        "responses": [
            "Hello! I'm Katambay-AI, your dengue surveillance assistant for Naga City. How can I help you today?",
            "Kumusta! Ako si Katambay-AI. Handa akong tumulong sa inyong mga katanungan tungkol sa dengue.",
            "Hi there! I'm here to help with dengue prevention, symptoms, and reporting. What do you need?"
        ]
    },
    {
        "tag": "symptoms",
        "patterns": [
            "what are dengue symptoms", "signs of dengue", "sintomas ng dengue",
            "how do I know if I have dengue", "dengue fever signs",
            "paano malalaman kung may dengue", "symptoms", "lagnat dengue",
            "dengue symptoms", "what does dengue feel like", "dengue warning signs",
            "masakit ang katawan dengue", "rash dengue", "bleeding dengue"
        ],
        "responses": [
            "⚠️ Key dengue symptoms:\n• Sudden high fever (38–40°C) for 2–7 days\n• Severe headache behind the eyes\n• Joint and muscle pain\n• Skin rash (red spots)\n• Nausea and vomiting\n• Mild bleeding (nose, gums)\n\n🚨 WARNING SIGNS (go to hospital immediately):\n• Severe abdominal pain\n• Persistent vomiting\n• Rapid breathing\n• Bleeding from gums or nose\n• Fatigue and restlessness\n\nIf you have these symptoms, consult Naga City General Hospital or BMC immediately.",
            "Ang mga sintomas ng dengue ay:\n• Mataas na lagnat (38–40°C)\n• Matinding sakit ng ulo\n• Pananakit ng kasukasuan\n• Pula-pulang pantal sa balat\n• Pagduduwal at pagsusuka\n\nKung may sintomas ka, pumunta agad sa pinakamalapit na ospital sa Naga City."
        ]
    },
    {
        "tag": "prevention",
        "patterns": [
            "how to prevent dengue", "paano maiwasan ang dengue", "dengue prevention",
            "pag-iwas sa dengue", "how to stop dengue", "4S campaign",
            "search and destroy", "prevent mosquito", "pag-iwas sa lamok",
            "how to avoid dengue", "dengue protection", "eliminate breeding sites",
            "clean water containers", "what can I do against dengue"
        ],
        "responses": [
            "🛡️ Follow the DOH 4S Campaign:\n\n1️⃣ SEARCH & DESTROY breeding sites\n• Empty, clean or throw away containers that hold water\n• Cover water storage containers tightly\n• Change flower vase water every 2 days\n• Clear clogged gutters and drains\n\n2️⃣ SELF-PROTECT\n• Wear long sleeves and pants\n• Use mosquito repellent (DEET-based)\n• Use mosquito nets when sleeping\n\n3️⃣ SEEK EARLY CONSULTATION\n• Go to the doctor at the first sign of fever\n• Don't self-medicate with Aspirin or Ibuprofen\n\n4️⃣ SAY YES to fogging only during outbreaks",
            "Para maiwasan ang dengue:\n• Alisin ang lahat ng nakatenggang tubig\n• Gumamit ng mosquito repellent\n• Magsuot ng mahabang damit\n• Huwag hayaang mag-ipon ng tubig sa mga basurahan\n• I-report ang breeding sites sa pamamagitan ng Katambay-AI app"
        ]
    },
    {
        "tag": "breeding_sites",
        "patterns": [
            "breeding sites", "where do mosquitoes breed", "saan nagtatayo ng lamok",
            "vector breeding", "aedes mosquito habitat", "mosquito eggs",
            "saan naglalagay ng itlog ang lamok", "where to check for mosquitoes",
            "dengue mosquito breeding", "eliminate mosquito habitat",
            "flower vase water", "tire water", "drum water dengue"
        ],
        "responses": [
            "🦟 Aedes aegypti mosquitoes breed in STAGNANT WATER. Common breeding sites in Naga City:\n\n• Uncovered water drums and containers\n• Flower vase water (change every 2 days)\n• Used tires with trapped water\n• Clogged roof gutters\n• Plant saucers under pots\n• Outdoor pet water bowls\n• Poorly sealed septic tanks\n• Construction site puddles\n\n✅ Check your home weekly and eliminate all standing water sources. Report suspicious sites using the Katambay-AI report feature."
        ]
    },
    {
        "tag": "hospital",
        "patterns": [
            "where to go hospital", "saan ospital", "dengue hospital naga",
            "bicol medical center", "BMC", "naga city general hospital",
            "where to seek medical help", "hospital for dengue",
            "emergency dengue", "nearest hospital", "clinic dengue naga",
            "medical center naga", "doctor dengue naga",
            "singapore hospital dengue", "SGH dengue", "NUH dengue",
            "tan tock seng hospital dengue", "TTSH dengue",
            "singapore general hospital", "hospital singapore",
            "polyclinic dengue singapore", "where to go dengue singapore"
        ],
        "responses": [
            "🏥 Hospitals for dengue in Naga City:\n\n• Bicol Medical Center (BMC) — Concepcion Grande\n  📞 (054) 472-0500\n\n• Naga City General Hospital — Panganiban Drive\n  📞 (054) 472-1736\n\n• NICC Doctors Hospital — Igualdad St.\n\n• Mother Seton Hospital — Gen. Luna St.\n\n🚨 If you see warning signs (severe abdominal pain, bleeding, difficulty breathing), go to the EMERGENCY ROOM immediately. Do not wait.",
            "🏥 Hospitals for dengue in Singapore:\n\n• Singapore General Hospital (SGH) — Outram Road\n  📞 6222 3322\n\n• Tan Tock Seng Hospital (TTSH) — Moulmein Road\n  📞 6256 6011\n\n• National University Hospital (NUH) — Lower Kent Ridge\n  📞 6779 5555\n\n• Changi General Hospital (CGH) — Simei\n  📞 6788 8833\n\n💊 For mild fever, visit any polyclinic first. Call 995 for emergencies.\n\n🚨 Go to A&E immediately if: severe abdominal pain, bleeding gums, vomiting blood, or extreme fatigue."
        ]
    },
    {
        "tag": "treatment",
        "patterns": [
            "dengue treatment", "paano gamutin ang dengue", "dengue cure",
            "what to take for dengue", "medicine for dengue", "gamot sa dengue",
            "how to treat dengue", "dengue remedy", "paracetamol dengue",
            "platelet count", "platelet dengue", "blood dengue"
        ],
        "responses": [
            "💊 DENGUE TREATMENT (there is NO specific cure):\n\n✅ DO:\n• Rest completely\n• Drink plenty of fluids (water, oral rehydration salts, coconut water)\n• Take PARACETAMOL only for fever and pain\n• Monitor platelet count — normal is 150,000–400,000/µL\n• Consult a doctor IMMEDIATELY\n\n❌ DO NOT:\n• Take Aspirin, Ibuprofen, or Mefenamic Acid — these worsen bleeding!\n• Self-medicate or delay hospital visit\n• Ignore warning signs\n\n⚠️ Dengue can be fatal if not treated properly. When in doubt, go to the nearest hospital."
        ]
    },
    {
        "tag": "report_how",
        "patterns": [
            "how to report", "paano mag-report", "submit report", "i-report",
            "how to submit breeding site", "report mosquito", "report dengue case",
            "mag-report ng dengue", "reporting feature", "how do I use report",
            "submit intel", "community report", "post report", "dengue report app"
        ],
        "responses": [
            "📋 How to report a dengue vector site using Katambay-AI:\n\n1. Tap the ⚡ REPORT tab at the bottom of the screen\n2. Use ARIA AI to describe the situation\n3. Or tap the Community tab → tap the + button\n4. Describe the breeding site or situation\n5. Tag your location (barangay or landmark)\n6. Attach a photo as evidence (tap Camera or Gallery)\n7. Tap POST INTEL to submit\n\nYour report goes to pending review and will be verified by the Naga City Health Office team. Thank you for being a Katambay Guardian!"
        ]
    },
    {
        "tag": "app_info",
        "patterns": [
            "what is katambay", "what is AEDE", "about this app", "what does this app do",
            "katambay AI", "tungkol sa app", "explain katambay", "AEDE system",
            "what is this", "what can you do", "help", "paano gamitin ang app",
            "app features", "what are app features"
        ],
        "responses": [
            "🤖 Katambay-AI is an AI-powered dengue vector surveillance system for Naga City, Bicol.\n\nFeatures:\n• 🗺️ Real-time dengue risk MAP by barangay\n• 📡 AI-powered ARIA chatbot (me!) for dengue Q&A\n• 📊 Outbreak prediction using LSTM machine learning\n• 📋 Citizen REPORTING of breeding sites\n• 👥 COMMUNITY feed for sharing local alerts\n• 🏅 Guardian missions and leaderboard to earn points\n\nDeveloped in coordination with Naga City LGU, CDRRMO, and DOH Region V."
        ]
    },
    {
        "tag": "risk_map",
        "patterns": [
            "risk map", "dengue map", "mapa ng dengue", "barangay risk",
            "high risk area", "where is dengue outbreak", "outbreak area naga",
            "check risk", "dengue levels", "dayangdang dengue", "concepcion dengue",
            "barangay risk level", "which areas are dangerous", "risk level",
            "singapore risk map", "dengue cluster singapore", "NEA dengue map",
            "high risk area singapore", "dengue zone singapore", "planning region dengue"
        ],
        "responses": [
            "🗺️ To check the Naga City Dengue Risk Map:\n\n1. Tap the MAP tab (🗺️) at the bottom of your screen\n2. The map shows all 27+ barangays with color-coded risk levels:\n   • 🔴 Red = HIGH RISK — active cases reported\n   • 🟡 Yellow = MODERATE RISK — elevated vector activity\n   • 🟢 Green = LOW RISK — minimal activity\n\nHigh-risk zones historically include Dayangdang, Concepcion Grande, and Tabuco.\n\nThe AI prediction model updates risk levels using weather data, historical cases, and IoT sensor readings.",
            "🗺️ To check the Singapore Dengue Risk Map:\n\n1. Tap the MAP tab (🗺️) at the bottom of your screen\n2. The map shows Singapore's planning regions (Central, North, North-East, East, West) with color-coded risk levels:\n   • 🔴 Red = HIGH RISK — active NEA dengue clusters\n   • 🟡 Yellow = MODERATE RISK — elevated vector activity\n   • 🟢 Green = LOW RISK — minimal activity\n\nHistorically, Central Region and North-East Region see elevated dengue activity.\n\nNEA's official dengue cluster data is updated regularly at dengue.gov.sg."
        ]
    },
    {
        "tag": "aedes_mosquito",
        "patterns": [
            "aedes aegypti", "aedes mosquito", "what mosquito causes dengue",
            "anong lamok ang nagdudulot ng dengue", "dengue mosquito",
            "tiger mosquito", "mosquito species", "aedes albopictus"
        ],
        "responses": [
            "🦟 About the Dengue Mosquito:\n\nDengue is caused by the bite of the **Aedes aegypti** mosquito.\n\nKey facts:\n• It has distinctive black and white stripe markings\n• It bites primarily DURING THE DAY (peak hours: early morning and late afternoon)\n• It breeds in CLEAN STAGNANT WATER (not dirty water)\n• It can fly up to 400 meters from its breeding site\n• Only the female mosquito bites\n• Incubation period: 4–10 days after the bite\n\n⚠️ Aedes aegypti is also the carrier of Zika and Chikungunya viruses."
        ]
    },
    {
        "tag": "mission_points",
        "patterns": [
            "missions", "how to earn points", "guardian mission", "points",
            "leaderboard", "earn XP", "guardian cadet", "guardian elite",
            "how to level up", "paano kumita ng points", "rank up"
        ],
        "responses": [
            "🏅 Guardian Missions & Points:\n\nYou can earn XP points by:\n• ✅ Completing Guardian Missions (shown in Profile tab)\n• 📋 Submitting verified community reports\n• 🗺️ Checking the risk map regularly\n• 💬 Engaging with the AI chatbot\n• 👥 Contributing to community discussions\n\nRanks:\n• Guardian Cadet (0–999 pts)\n• Guardian Elite (1000–2499 pts)\n• Guardian Commander (2500+ pts)\n\nTop guardians appear on the leaderboard in the Profile tab!"
        ]
    },
    {
        "tag": "rainy_season",
        "patterns": [
            "rainy season dengue", "tag-ulan dengue", "monsoon dengue",
            "weather dengue", "rain mosquito", "dengue after typhoon",
            "flooding dengue", "habagat dengue", "ulan at dengue"
        ],
        "responses": [
            "🌧️ Dengue during Rainy Season:\n\nDengue cases SPIKE during and after heavy rainfall because:\n• Rain creates new puddles and pools where Aedes breeds\n• Warm, humid conditions accelerate mosquito life cycle\n• Flooded areas create hidden breeding grounds\n\n⚠️ After typhoons and heavy rain:\n• Check all containers and drainage immediately\n• Wear long clothes even indoors\n• Apply repellent more frequently\n• Be extra alert for fever symptoms\n\nKatambay-AI monitors rainfall data from OpenWeatherMap to predict outbreak risks in Naga City."
        ]
    },
    {
        "tag": "fogging",
        "patterns": [
            "fogging", "malathion", "fumigation", "request fogging",
            "mag-request ng fogging", "pesticide spray", "aerial spray",
            "dengue spray", "when to fog", "fogging schedule",
            "NEA fogging singapore", "singapore fogging", "thermal fogging singapore",
            "wolbachia singapore", "project wolbachia"
        ],
        "responses": [
            "🌫️ About Fogging (Chemical Control) — Philippines:\n\nThe DOH and Naga City Health Office ONLY recommend fogging:\n• During active outbreaks (dengue cases confirmed in an area)\n• NOT as a preventive measure\n\nWhy? Fogging kills ADULT mosquitoes but NOT eggs or larvae. It only provides short-term relief.\n\n✅ More effective long-term solutions:\n• Search and Destroy (eliminating breeding sites)\n• Ovicidal-larvicidal traps (OL traps)\n• Biological control (Bacillus thuringiensis)\n\nTo request fogging from Naga City Health Office:\n📞 Contact NCHO: (054) 472-0558",
            "🌫️ About Dengue Control in Singapore:\n\n• NEA conducts thermal fogging in confirmed cluster areas\n• NEA's Project Wolbachia releases male Wolbachia-Aedes mosquitoes to reduce dengue mosquito population\n• Inspectors are deployed to areas with active dengue clusters\n\n✅ What you can do:\n• Check your home for stagnant water every week (Mozzie Wipeout)\n• Tip, toss, scrub all water containers\n• Report breeding sites to NEA via myENV app or 1800-CALL-NEA\n\n⚠️ Fogging alone is not sufficient — source reduction is key!"
        ]
    },
    {
        "tag": "singapore_specific",
        "patterns": [
            "singapore dengue", "NEA dengue", "dengue cluster singapore",
            "dengue singapore 2024", "dengue singapore 2025", "singapore dengue cases",
            "dengue gov sg", "NEA alert", "dengue alert singapore",
            "tampines dengue", "woodlands dengue", "jurong dengue", "punggol dengue",
            "yishun dengue", "bedok dengue", "ang mo kio dengue",
            "bishan dengue", "hougang dengue", "sengkang dengue",
            "project wolbachia", "wolbachia mosquito", "dengue surveillance singapore",
            "central region dengue", "north region dengue", "east region dengue"
        ],
        "responses": [
            "📍 Dengue Situation in Singapore:\n\nSingapore consistently reports thousands of dengue cases annually. The National Environment Agency (NEA) monitors all dengue clusters.\n\nKatambay-AI tracks Singapore's 5 Planning Regions:\n• Central Region — includes Queenstown, Bishan, Toa Payoh (historically higher cluster density)\n• North-East Region — Hougang, Punggol, Sengkang\n• East Region — Bedok, Tampines, Changi\n• North Region — Woodlands, Yishun, Sembawang\n• West Region — Jurong, Bukit Batok, Clementi\n\nNEA's official tracking: dengue.gov.sg\n\nReport suspected breeding sites via myENV app or call 1800-CALL-NEA (1800-2255-632).",
            "🦟 Singapore Dengue Facts:\n\n• Singapore's tropical climate makes it year-round dengue territory\n• Aedes aegypti AND Aedes albopictus are both present in Singapore\n• NEA runs Project Wolbachia — releasing sterile male Wolbachia mosquitoes to suppress wild mosquito populations\n• The Mozzie Wipeout campaign encourages weekly home inspections\n\n🔴 High-risk periods: During El Niño weather events (hotter, drier spells) dengue clusters tend to spike.\n\nKatambay-AI overlays real-time weather data on the Singapore risk map to help you stay ahead of outbreaks."
        ]
    },
    {
        "tag": "naga_specific",
        "patterns": [
            "naga city", "bicol dengue", "dayangdang", "concepcion pequeña",
            "tabuco", "igualdad", "naga dengue outbreak", "peñafrancia",
            "balatas dengue", "triangulo dengue", "liboton dengue",
            "naga barangay", "bicol region dengue"
        ],
        "responses": [
            "📍 Dengue Situation in Naga City:\n\nNaga City is located in Bicol Region, which consistently records high dengue cases annually.\n\nHistorically high-risk barangays:\n• Dayangdang — Zone 4 (residential density + drainage issues)\n• Concepcion Grande/Pequeña (urban flooding risk)\n• Tabuco (market area, stagnant drains)\n• Liboton and Triangulo\n\nKatambay-AI continuously monitors:\n• CDRRMO incident reports\n• DOH Region V case data\n• IoT environmental sensor readings\n• Community reports from Guardian volunteers\n\nReport any breeding sites you see using the Community tab! 🦟"
        ]
    },
    {
        "tag": "goodbye",
        "patterns": [
            "bye", "goodbye", "thank you", "salamat", "ok thanks", "that's all",
            "exit", "done", "sige", "paalam", "thanks", "okay bye", "ok bye"
        ],
        "responses": [
            "Stay safe and keep Naga City dengue-free! 🦟 Remember — search, destroy, protect! 💪",
            "Salamat! Ingat lagi at magtulungan nating mapigilan ang dengue sa Naga City! 🏙️",
            "Take care! If you spot any breeding sites, use the Report tab to alert the community. Mabuhay! 🇵🇭"
        ]
    },
    {
        "tag": "unclear",
        "patterns": [
            "what", "huh", "I don't understand", "repeat", "can you explain",
            "what do you mean", "unclear", "ayoko", "bakit", "paano"
        ],
        "responses": [
            "I'm sorry, I didn't quite understand. I can help you with:\n• Dengue symptoms and treatment\n• Prevention tips (4S Campaign)\n• Risk map information\n• How to report breeding sites\n• Hospital locations in Naga City\n• App features\n\nWhat would you like to know?",
            "Paumanhin, hindi ko naintindihan. Maaari akong tumulong sa:\n• Sintomas ng dengue\n• Pag-iwas sa dengue\n• Paano mag-report\n• Mga ospital sa Naga City\n\nAnong gusto mong malaman?"
        ]
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# 2. Text Preprocessing
# ─────────────────────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return text

# Build vocabulary from all patterns
all_words = []
all_patterns = []
all_tags = []

for intent in INTENTS:
    for pattern in intent["patterns"]:
        cleaned = clean_text(pattern).split()
        all_words.extend(cleaned)
        all_patterns.append(clean_text(pattern))
        all_tags.append(intent["tag"])

# Vocabulary
vocab = sorted(set(all_words))
word_to_idx = {w: i + 1 for i, w in enumerate(vocab)}  # 0 = padding
VOCAB_SIZE = len(vocab) + 1
MAX_SEQ_LEN = 15  # tokens per input

# Label encoding
label_encoder = LabelEncoder()
label_encoder.fit(all_tags)
NUM_CLASSES = len(label_encoder.classes_)

print(f"[✓] Vocabulary: {VOCAB_SIZE - 1} words | Classes: {NUM_CLASSES} intents | Samples: {len(all_patterns)}")

# Tokenize + pad
def tokenize_and_pad(text: str) -> list:
    tokens = [word_to_idx.get(w, 0) for w in clean_text(text).split()]
    if len(tokens) < MAX_SEQ_LEN:
        tokens += [0] * (MAX_SEQ_LEN - len(tokens))
    return tokens[:MAX_SEQ_LEN]

X = np.array([tokenize_and_pad(p) for p in all_patterns])
y = label_encoder.transform(all_tags)
y_cat = keras.utils.to_categorical(y, num_classes=NUM_CLASSES)

# Shuffle dataset to ensure representative split for validation
indices = np.arange(X.shape[0])
np.random.seed(42)  # for reproducible shuffling
np.random.shuffle(indices)
X = X[indices]
y_cat = y_cat[indices]

# ─────────────────────────────────────────────────────────────────────────────
# 3. Model Architecture — Embedding + LSTM
# ─────────────────────────────────────────────────────────────────────────────

model = keras.Sequential([
    keras.layers.Input(shape=(MAX_SEQ_LEN,)),
    keras.layers.Embedding(VOCAB_SIZE, 64),
    keras.layers.LSTM(128, return_sequences=False),
    keras.layers.Dense(64, activation='relu'),
    keras.layers.Dense(NUM_CLASSES, activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

model.summary()

# ─────────────────────────────────────────────────────────────────────────────
# 4. Training
# ─────────────────────────────────────────────────────────────────────────────

print("\n[*] Training LSTM model...")
history = model.fit(
    X, y_cat,
    epochs=300,
    batch_size=8,
    verbose=1
)

final_acc = history.history['accuracy'][-1]
print(f"\n[✓] Training complete. Final accuracy: {final_acc:.2%}")

# ─────────────────────────────────────────────────────────────────────────────
# 5. Export Weights to JSON and TFLite
# ─────────────────────────────────────────────────────────────────────────────

output_dir = os.path.join("assets", "models")
os.makedirs(output_dir, exist_ok=True)

# Export raw weights for pure JS/TS inference fallback
print("[*] Exporting model weights to JSON...")
weights = model.get_weights()
weights_dict = {
    "embedding": weights[0].tolist(),
    "lstm_kernel": weights[1].tolist(),
    "lstm_recurrent_kernel": weights[2].tolist(),
    "lstm_bias": weights[3].tolist(),
    "dense1_kernel": weights[4].tolist(),
    "dense1_bias": weights[5].tolist(),
    "dense2_kernel": weights[6].tolist(),
    "dense2_bias": weights[7].tolist(),
}
weights_path = os.path.join(output_dir, "chatbot_weights.json")
with open(weights_path, "w") as f:
    json.dump(weights_dict, f)
print(f"[✓] Model weights saved: {weights_path} ({os.path.getsize(weights_path)/1024:.1f} KB)")

# Try TFLite conversion
tflite_saved = False
size_kb = 0.0
try:
    print("[*] Converting to TFLite (Optional)...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    # Configure converter to handle TF select ops if needed
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS
    ]
    converter._experimental_lower_tensor_list_ops = False
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()

    tflite_path = os.path.join(output_dir, "chatbot.tflite")
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)
    size_kb = len(tflite_model) / 1024
    print(f"[✓] TFLite model saved: {tflite_path} ({size_kb:.1f} KB)")
    tflite_saved = True
except Exception as e:
    print(f"[✗] TFLite conversion failed (using JSON weights fallback instead). Error: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# 6. Save tokenizer + intents config for the app
# ─────────────────────────────────────────────────────────────────────────────

tokenizer_config = {
    "word_to_idx": word_to_idx,
    "vocab_size": VOCAB_SIZE,
    "max_seq_len": MAX_SEQ_LEN,
}
with open(os.path.join(output_dir, "tokenizer_config.json"), "w", encoding="utf-8") as f:
    json.dump(tokenizer_config, f, ensure_ascii=False, indent=2)
print(f"[✓] Tokenizer config saved.")

# Save intents with class labels for response lookup
intents_export = {
    "classes": label_encoder.classes_.tolist(),
    "intents": [
        {
            "tag": intent["tag"],
            "responses": intent["responses"]
        }
        for intent in INTENTS
    ]
}
with open(os.path.join(output_dir, "intents.json"), "w", encoding="utf-8") as f:
    json.dump(intents_export, f, ensure_ascii=False, indent=2)
print(f"[✓] Intents config saved.")

print(f"""
╔══════════════════════════════════════════════════════════════╗
║          Katambay-AI Chatbot Training COMPLETE               ║
╠══════════════════════════════════════════════════════════════╣
║  Model accuracy:  {final_acc:.2%}                                  
║  Weights size:    {os.path.getsize(weights_path)/1024:.1f} KB
║  TFLite size:     {size_kb:.1f} KB {"(Failed)" if not tflite_saved else ""}
║  Output files:    assets/models/chatbot_weights.json         ║
║                   assets/models/intents.json                 ║
║                   assets/models/tokenizer_config.json        ║
╚══════════════════════════════════════════════════════════════╝

Next: Integrate lib/tfliteChatbot.ts using JS inference engine.
""")
