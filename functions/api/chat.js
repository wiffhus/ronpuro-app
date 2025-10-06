export async function onRequest(context) {
  const { request, env } = context;
  
  // CORSヘッダーの設定
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  // OPTIONSリクエスト（プリフライト）への対応
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders
    });
  }
  try {
    const { message, systemPrompt, history, persona } = await request.json();
    
    // ペルソナに応じてAPIキーを選択
    let API_KEY;
    switch(persona) {
      case 'pronpa':
        API_KEY = env.GEMINI_API_KEY_PRONPA;
        break;
      case 'nankuru':
        API_KEY = env.GEMINI_API_KEY_NANKURU;
        break;
      case 'fuan':
        API_KEY = env.GEMINI_API_KEY_FUAN;
        break;
      default:
        API_KEY = env.GOOGLE_API_KEY; // 念のためフォールバック
    }
    
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: `API key not configured for persona: ${persona}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // 会話履歴をGemini形式に変換
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '承知しました。ルールに従って応答します。' }] }
    ];
    // historyが存在する場合、履歴を追加
    if (history && history.length > 0) {
      history.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });
    }
    // 最新のメッセージを追加
    contents.push({ role: 'user', parts: [{ text: message }] });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048,
          }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';
    return new Response(JSON.stringify({ text }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
