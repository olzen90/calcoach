import { useEffect, useRef, useCallback, forwardRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

const VoiceInput = forwardRef(function VoiceInput({ onResult, onSendCommand, isRecording, setIsRecording, language = 'en-US' }, ref) {
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  const onSendCommandRef = useRef(onSendCommand)
  const setIsRecordingRef = useRef(setIsRecording)
  const isRecordingRef = useRef(isRecording)
  const shouldRestartRef = useRef(false)
  
  // Keep refs updated
  useEffect(() => {
    onResultRef.current = onResult
    onSendCommandRef.current = onSendCommand
    setIsRecordingRef.current = setIsRecording
    isRecordingRef.current = isRecording
  }, [onResult, onSendCommand, setIsRecording, isRecording])
  
  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser')
      return
    }
    
    const recognition = new SpeechRecognition()
    recognition.continuous = false  // Process one utterance, then restart
    recognition.interimResults = false  // Only get final results
    // Use the language prop from settings
    recognition.lang = language
    
    // Send command keywords (works in multiple languages)
    const sendKeywords = ['send', 'send besked', 'send beskeden', 'afsend', 'submit']
    
    recognition.onresult = (event) => {
      // Get the transcript from this recognition session
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      
      if (!transcript) return
      
      console.log('Voice result:', transcript)
      
      // Check if it's a send command
      const lowerTranscript = transcript.toLowerCase()
      const isSendCommand = sendKeywords.some(keyword => 
        lowerTranscript === keyword || 
        lowerTranscript.endsWith(' ' + keyword) ||
        lowerTranscript.endsWith('.' + keyword) ||
        lowerTranscript.endsWith(',' + keyword)
      )
      
      if (isSendCommand) {
        // Remove the send keyword from the end
        let cleanText = transcript
        for (const keyword of sendKeywords) {
          const regex = new RegExp('[\\s.,]*' + keyword + '$', 'i')
          cleanText = cleanText.replace(regex, '')
        }
        
        // Add any remaining text before sending
        if (cleanText.trim()) {
          onResultRef.current(cleanText.trim() + ' ')
        }
        
        // Stop recording and trigger send
        shouldRestartRef.current = false
        
        // Trigger send command
        if (onSendCommandRef.current) {
          setTimeout(() => {
            onSendCommandRef.current()
          }, 100)
        }
        return
      }
      
      // Add the transcript with a space for continuous dictation
      onResultRef.current(transcript + ' ')
    }
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      
      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false
        setIsRecordingRef.current(false)
        alert('Mikrofonadgang nægtet. Tillad venligst mikrofon i browserindstillingerne.')
      } else if (event.error === 'network') {
        shouldRestartRef.current = false
        setIsRecordingRef.current(false)
        alert('Netværksfejl. Talegenkendelse kræver internet.')
      } else if (event.error === 'no-speech') {
        // Silent - will restart automatically
      } else if (event.error === 'audio-capture') {
        shouldRestartRef.current = false
        setIsRecordingRef.current(false)
        alert('Ingen mikrofon fundet.')
      } else if (event.error === 'aborted') {
        // User stopped - don't restart
      }
    }
    
    recognition.onend = () => {
      // Restart if we should still be recording (handles pause between utterances)
      if (shouldRestartRef.current && isRecordingRef.current) {
        try {
          recognition.start()
        } catch (e) {
          setIsRecordingRef.current(false)
        }
      } else {
        setIsRecordingRef.current(false)
      }
    }
    
    recognitionRef.current = recognition
    
    return () => {
      shouldRestartRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
        }
      }
    }
  }, [language]) // Re-create recognition when language changes
  
  // Stop recognition whenever the parent sets isRecording → false externally
  // (e.g. when the form is submitted or the component unmounts).
  useEffect(() => {
    if (!isRecording) {
      shouldRestartRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (_) {}
      }
    }
  }, [isRecording])

  // Stop when the page loses focus or becomes hidden (app switch, tab change).
  useEffect(() => {
    const stop = () => {
      if (isRecordingRef.current) {
        shouldRestartRef.current = false
        setIsRecordingRef.current(false)
        if (recognitionRef.current) {
          try { recognitionRef.current.stop() } catch (_) {}
        }
      }
    }

    const onVisibility = () => { if (document.hidden) stop() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', stop)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', stop)
    }
  }, [])

  const toggleRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      alert('Talegenkendelse understøttes ikke i din browser. Brug Chrome for stemmeinput.')
      return
    }
    
    if (isRecording) {
      shouldRestartRef.current = false
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore errors when stopping
      }
      setIsRecording(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        
        shouldRestartRef.current = true
        recognitionRef.current.start()
        setIsRecording(true)
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          alert('Mikrofonadgang nægtet. Tillad venligst mikrofon for at bruge stemmeinput.')
        } else {
          alert('Kunne ikke tilgå mikrofon.')
        }
      }
    }
  }, [isRecording, setIsRecording])
  
  // Check for browser support
  const isSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  
  if (!isSupported) {
    return null
  }
  
  return (
    <button
      ref={ref}
      type="button"
      onClick={toggleRecording}
      className={`p-1 rounded-full transition-all duration-200 flex-shrink-0 ${
        isRecording 
          ? 'bg-red-500 text-white animate-pulse' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      {isRecording ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  )
})

export default VoiceInput
