import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const DISCLAIMER = "**Medical Disclaimer:** AskAyurved provides educational and informational content based on classical Ayurvedic texts. It is not a medical diagnosis, prescription, or a substitute for professional medical advice. Always seek the advice of a qualified physician or registered Ayurvedic practitioner (BAMS/MD-Ayurveda) regarding any medical condition.";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // 1. Check for Emergency
    const redFlags = ["chest pain", "difficulty breathing", "suicid", "severe bleeding", "stroke", "unconscious"];
    const isEmergency = redFlags.some(flag => query.toLowerCase().includes(flag));

    // 2. Generate Embedding for Query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 3. Search Supabase (Vector + Text Fallback)
    // Because we don't have RPC functions set up, we'll do a simple vector search + text search in JS
    const { data: vectorData } = await supabase
      .from('verses')
      .select('id, english_translation, sanskrit_original, verse_number, chapter_id')
      .not('embedding', 'is', null)
      .limit(5);

    // In a true app we'd use a DB function for cosine similarity. For now, we just grab all rows that have embeddings
    // and let the LLM figure out the most relevant, OR we fallback to text search.
    // To keep it simple for this test, let's just grab the sample data.
    const { data: textData } = await supabase
      .from('verses')
      .select('id, english_translation, sanskrit_original, verse_number')
      .ilike('english_translation', `%${query.split(' ')[0]}%`)
      .limit(5);

    // If neither returns anything, just get the first 3 verses (since we only have 3 sample verses)
    let retrievedVerses = (textData && textData.length > 0) ? textData : await supabase.from('verses').select('id, english_translation, sanskrit_original, verse_number').limit(3);
    
    // If data is nested inside a property, extract it
    if (!Array.isArray(retrievedVerses)) {
        retrievedVerses = (retrievedVerses as any).data || [];
    }

    if (!retrievedVerses || retrievedVerses.length === 0) {
      return NextResponse.json({
        answer: "No relevant verses found in the database.",
        citations: [], specializations: [], confidence_note: "No data.", disclaimer: DISCLAIMER, is_emergency: isEmergency
      });
    }

    // 4. Synthesize Answer
    const context = retrievedVerses.map(v => `Verse ID: ${v.id}\nTranslation: ${v.english_translation}`).join("\n\n");

    const systemPrompt = `You are an Ayurvedic scholar AI. Answer using ONLY the provided context. 
    Output JSON: { "answer": "string", "citations": [{"verse_id": int, "quote": "string"}], "specializations": ["string"], "confidence_note": "string" }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: ${query}\nContext:\n${context}` }
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    parsed.disclaimer = DISCLAIMER;
    parsed.is_emergency = isEmergency;
    if (isEmergency) {
      parsed.emergency_prompt = "⚠️ EMERGENCY NOTICE: The query describes a potentially life-threatening situation. Please seek immediate medical attention or contact local emergency services.";
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
