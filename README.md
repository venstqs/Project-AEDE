# AEDE (Katambay-AI) 🦟🛡️

AEDE is a comprehensive mobile application built to combat the spread of Dengue fever. Powered by Artificial Intelligence and machine learning, this application empowers communities to identify, report, and predict Dengue outbreaks and mosquito breeding sites.

## 🚀 Features

* **📱 Cross-Platform Mobile App**: Built with Expo and React Native, offering seamless experience on both iOS and Android.
* **📸 Hazard Reporting**: Users can take photos or upload images from their gallery to report Dengue hazards and potential mosquito breeding sites.
* **🧠 AI-Powered Detection (CNN)**: Integrated Convolutional Neural Network (CNN) models for image classification.
* **🔮 Outbreak Predictor**: Machine learning module utilizing a Random Forest model to analyze data and predict potential dengue outbreak zones.
* **💬 Smart Chatbot**: An intelligent assistant ready to answer questions about Dengue prevention, symptoms, and community health.
* **☁️ Cloud Backend**: Powered by Supabase for robust, secure, and scalable database management.

## 🛠️ Technology Stack

* **Frontend:** React Native, Expo, Expo Router
* **Backend:** Supabase (PostgreSQL, Authentication, Storage)
* **Machine Learning:** Python, Scikit-Learn (Random Forest), TensorFlow/Keras (CNN)
* **Database & Data:** SQL

## 🚦 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Python 3.x](https://www.python.org/) (for ML training scripts)
- Expo CLI or [Expo Go](https://expo.dev/go) app on your mobile device.

### 1. Installation

Clone the repository and install the JavaScript dependencies:

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root of the project based on the `.env.example` file. You will need to add your Supabase keys and other specific configuration variables:

```bash
cp .env.example .env
```

### 3. Start the App

Run the development server:

```bash
npx expo start
```

You can then open the app:
- On your physical device using the **Expo Go** app (scan the QR code).
- On an **Android emulator**.
- On an **iOS simulator**.

## 🧠 Machine Learning Scripts

The project includes several Python scripts located in the root directory for training the AI models:

* `train_cnn_classifier.py` - Trains the image classification model for hazard detection.
* `ml_outbreak_predictor.py` - Manages the outbreak prediction logic.
* `train_chatbot.py` - Trains the chatbot's conversational AI model.
* `generate_finalist_charts.py` - Generates analytical charts based on the predictions.

## 🗄️ Database Setup

The necessary SQL scripts to set up the Supabase backend are provided:
* `supabase_setup.sql`: Initial schema and tables.
* `seed_dummy_posts.sql`: Dummy data for testing.

---

*This project is private and intended for the development team.*
