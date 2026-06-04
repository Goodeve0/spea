/**
 * 浏览器端语音合成（Web Speech API SpeechSynthesis）
 * 替代服务端 TTS，延迟更低、免费
 */

export class BrowserSpeechSynthesis {
  private utterance: SpeechSynthesisUtterance | null = null;
  private speaking = false;

  speak(text: string, onEnd?: () => void): void {
    // 先停掉当前播放
    this.stop();

    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // 选择英语声音
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Female'))
      ?? voices.find((v) => v.lang.startsWith('en-US'))
      ?? voices.find((v) => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      this.speaking = true;
    };

    utterance.onend = () => {
      this.speaking = false;
      onEnd?.();
    };

    utterance.onerror = () => {
      this.speaking = false;
      onEnd?.();
    };

    this.utterance = utterance;
    speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return speechSynthesis.speaking;
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
}
