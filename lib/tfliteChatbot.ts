import weightsData from '../assets/models/chatbot_weights.json';
import tokenizerConfig from '../assets/models/tokenizer_config.json';
import intentsData from '../assets/models/intents.json';

// Define typed structures for model weights
interface ChatbotWeights {
  embedding: number[][];
  lstm_kernel: number[][];
  lstm_recurrent_kernel: number[][];
  lstm_bias: number[];
  dense1_kernel: number[][];
  dense1_bias: number[];
  dense2_kernel: number[][];
  dense2_bias: number[];
}

const weights = weightsData as unknown as ChatbotWeights;
const wordToIdx = tokenizerConfig.word_to_idx as Record<string, number>;
const maxSeqLen = tokenizerConfig.max_seq_len;
const intents = intentsData.intents;
const classes = intentsData.classes;

// Standard activation functions
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function relu(x: number): number {
  return Math.max(0, x);
}

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / (sum || 1));
}

/**
 * Preprocesses and tokenizes the input text.
 */
function preprocessAndTokenize(text: string): number[] {
  // Clean text: lowercase and remove non-alphanumeric characters (except spaces)
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  // Map to vocabulary indices (0 for OOV / padding)
  const tokens = words.map(word => wordToIdx[word] ?? 0);

  // Pad or truncate to maxSeqLen
  if (tokens.length < maxSeqLen) {
    while (tokens.length < maxSeqLen) {
      tokens.push(0);
    }
  } else if (tokens.length > maxSeqLen) {
    return tokens.slice(0, maxSeqLen);
  }

  return tokens;
}

/**
 * Runs forward pass of the LSTM neural network.
 */
function predictIntent(tokens: number[]): string {
  const lstmUnits = 128;
  const embeddingDim = 64;

  // 1. Embedding lookup
  // Shape of tokens: [15] -> Shape of embeddings: [15, 64]
  const xSeq: number[][] = tokens.map(t => {
    // If token index is out of bounds, use zero padding
    if (t < 0 || t >= weights.embedding.length) {
      return new Array(embeddingDim).fill(0);
    }
    return weights.embedding[t];
  });

  // 2. LSTM Forward Pass
  // Initialize hidden (h) and cell (c) states
  let h = new Array(lstmUnits).fill(0);
  let c = new Array(lstmUnits).fill(0);

  // Iterate over each time step (token)
  for (let t = 0; t < maxSeqLen; t++) {
    const x = xSeq[t];
    const z = new Array(lstmUnits * 4).fill(0);

    // Initialize gate inputs z with LSTM bias
    for (let k = 0; k < lstmUnits * 4; k++) {
      z[k] = weights.lstm_bias[k];
    }

    // Add input kernel dot product: x * W_lstm
    for (let i = 0; i < embeddingDim; i++) {
      const xi = x[i];
      const kernelRow = weights.lstm_kernel[i];
      for (let k = 0; k < lstmUnits * 4; k++) {
        z[k] += xi * kernelRow[k];
      }
    }

    // Add recurrent kernel dot product: h * U_lstm
    for (let j = 0; j < lstmUnits; j++) {
      const hj = h[j];
      const recurrentRow = weights.lstm_recurrent_kernel[j];
      for (let k = 0; k < lstmUnits * 4; k++) {
        z[k] += hj * recurrentRow[k];
      }
    }

    // Split z into 4 LSTM gates (Keras standard gate ordering: i, f, c, o)
    const nextH = new Array(lstmUnits).fill(0);
    const nextC = new Array(lstmUnits).fill(0);

    for (let j = 0; j < lstmUnits; j++) {
      const gateI = sigmoid(z[j]);
      const gateF = sigmoid(z[lstmUnits + j]);
      const gateCtilde = Math.tanh(z[lstmUnits * 2 + j]);
      const gateO = sigmoid(z[lstmUnits * 3 + j]);

      // Cell state update: c_t = f_t * c_{t-1} + i_t * c_tilde
      nextC[j] = gateF * c[j] + gateI * gateCtilde;

      // Hidden state update: h_t = o_t * tanh(c_t)
      nextH[j] = gateO * Math.tanh(nextC[j]);
    }

    h = nextH;
    c = nextC;
  }

  // 3. Dense Layer 1 (FC with ReLU)
  // Input shape: [128], Output shape: [64]
  const d1Units = 64;
  const d1 = new Array(d1Units).fill(0);
  for (let k = 0; k < d1Units; k++) {
    d1[k] = weights.dense1_bias[k];
    for (let j = 0; j < lstmUnits; j++) {
      d1[k] += h[j] * weights.dense1_kernel[j][k];
    }
    d1[k] = relu(d1[k]);
  }

  // 4. Dense Layer 2 (Output Layer with Softmax)
  // Input shape: [64], Output shape: [NUM_CLASSES] (18)
  const numClasses = classes.length;
  const d2 = new Array(numClasses).fill(0);
  for (let k = 0; k < numClasses; k++) {
    d2[k] = weights.dense2_bias[k];
    for (let j = 0; j < d1Units; j++) {
      d2[k] += d1[j] * weights.dense2_kernel[j][k];
    }
  }

  const probabilities = softmax(d2);

  // 5. Argmax to find the predicted intent index
  let maxIdx = 0;
  let maxVal = -1;
  for (let i = 0; i < numClasses; i++) {
    if (probabilities[i] > maxVal) {
      maxVal = probabilities[i];
      maxIdx = i;
    }
  }

  return classes[maxIdx];
}

/**
 * Chat interface: tokenizes, predicts intent, and returns response.
 */
export async function chat(userMessage: string): Promise<string> {
  try {
    const tokens = preprocessAndTokenize(userMessage);
    const predictedTag = predictIntent(tokens);

    // Look up responses for the predicted intent tag
    const matchingIntent = intents.find(intent => intent.tag === predictedTag);
    if (!matchingIntent || matchingIntent.responses.length === 0) {
      return "I'm sorry, I'm not sure how to answer that. Could you rephrase your question?";
    }

    // Pick a random response from the matches
    const randomIndex = Math.floor(Math.random() * matchingIntent.responses.length);
    return matchingIntent.responses[randomIndex];
  } catch (error) {
    console.error("Offline chatbot inference error:", error);
    return "Offline Assistant: I'm having trouble understanding right now. Please try again later.";
  }
}
