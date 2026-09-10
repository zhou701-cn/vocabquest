import {
  BadRequestException,
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common'

/**
 * AI 单词生成（Gemini）。
 * 未配置 GEMINI_API_KEY 时返回 503，前端提示稍后重试。
 * 国内服务器可将 baseUrl 替换为可用的 Gemini 代理或国内大模型兼容接口。
 */
@Controller('ai')
export class AiController {
  @Post('generate-word')
  async generateWord(@Body() body: { word: string; targetGrade?: number }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI generation is not configured (GEMINI_API_KEY missing)',
      )
    }
    if (!body.word?.trim()) {
      throw new BadRequestException('word is required')
    }

    const prompt = `You are an educational content creator for elementary school students (grade ${body.targetGrade ?? 4}) preparing for the SSAT.
Generate vocabulary content for the word "${body.word.trim()}".
Respond with ONLY a JSON object (no markdown fences) with these fields:
{
  "word": string,
  "part_of_speech": one of "noun"|"verb"|"adjective"|"adverb"|"pronoun"|"preposition"|"conjunction"|"interjection",
  "definition": string (age-appropriate, 8-12 years old),
  "example_sentence": string (educational, must contain the exact word),
  "synonyms": string[] (2-4 items),
  "antonyms": string[] (0-3 items),
  "difficulty_level": number 1-5,
  "ssat_importance": number 1-5,
  "pronunciation_guide": string (e.g. "KOL-ab-uh-rate"),
  "usage_notes": string,
  "frequency_score": number 1-5
}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      },
    )

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `AI provider error: HTTP ${response.status}`,
      )
    }

    const result = await response.json()
    const text: string =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let wordData: Record<string, any>
    try {
      const cleaned = text.replace(/```json|```/g, '').trim()
      wordData = JSON.parse(cleaned)
    } catch {
      throw new ServiceUnavailableException('Failed to parse AI response')
    }

    return { data: wordData }
  }

  /**
   * 单词音频生成（当前为模拟实现，与原有行为一致）：
   * 直接返回本地静态音频路径，音频文件托管在前端 public/audio/ 下。
   * 后续接入 TTS（阿里云/讯飞等）时在此替换实现即可。
   */
  @Post('word-audio')
  async generateAudio(@Body() body: { word: string; wordId?: number }) {
    if (!body.word?.trim()) {
      throw new BadRequestException('word is required')
    }
    const word = body.word.trim().toLowerCase()
    return {
      data: {
        audio_url: `/audio/${word}.mp3`,
        word,
        cached: true,
      },
    }
  }
}
