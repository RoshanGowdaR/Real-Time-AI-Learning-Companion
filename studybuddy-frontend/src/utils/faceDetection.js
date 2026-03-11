import { api } from '../services/api'

let detectionInterval = null
let registeredVideoRef = null
let detectionInFlight = false

export function setFaceDetectionVideoRef(videoRef) {
  registeredVideoRef = videoRef
}

function resolveVideoElement(videoRef) {
  return videoRef?.current || registeredVideoRef?.current || null
}

function clearDetectionInterval() {
  if (detectionInterval) {
    window.clearInterval(detectionInterval)
    detectionInterval = null
  }
}

export async function startFaceDetection(studentId, onEmotionDetected, videoRef) {
  if (!studentId) {
    throw new Error('Student is not available for face detection.')
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.')
  }

  const videoElement = resolveVideoElement(videoRef)
  if (!videoElement) {
    throw new Error('Video preview element is not ready.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })

  videoElement.srcObject = stream
  await videoElement.play()

  clearDetectionInterval()
  detectionInFlight = false

  await captureAndAnalyze(studentId, onEmotionDetected, videoRef)

  detectionInterval = window.setInterval(() => {
    if (detectionInFlight) return

    captureAndAnalyze(studentId, onEmotionDetected, videoRef).catch((err) => {
      console.error('Face detection capture failed', err)
    })
  }, 5000)

  return stream
}

export async function captureAndAnalyze(studentId, onEmotionDetected, videoRef) {
  if (detectionInFlight) return

  const videoElement = resolveVideoElement(videoRef)
  if (!videoElement || videoElement.readyState < 2) return

  detectionInFlight = true

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoElement, 0, 0, 320, 240)

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.8)
    })

    if (!blob) return

    const data = await api.analyzeEmotion(blob, studentId)
    if (typeof onEmotionDetected === 'function') {
      onEmotionDetected(data.emotion, data.confidence)
    }
  } catch (err) {
    console.error('Emotion analyze request failed', err)
    if (typeof onEmotionDetected === 'function') {
      onEmotionDetected('no_face', 0)
    }
  } finally {
    detectionInFlight = false
  }
}

export function stopFaceDetection(stream, videoRef) {
  clearDetectionInterval()
  detectionInFlight = false

  if (stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach((track) => track.stop())
  }

  const videoElement = resolveVideoElement(videoRef)
  if (videoElement) {
    videoElement.srcObject = null
  }
}
