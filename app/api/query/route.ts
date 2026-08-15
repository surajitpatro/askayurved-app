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

    // 2. Search Supabase Database
    // We will do a simple text search first. If no results, grab the first 3 verses.
    let retrievedVerses: any[] = [];

    const { data: textMatches } = await supabase
      .from('verses')
      .select('id, english_translation, sanskrit_original, verse_number')
      .ilike('english_translation', `%${query.split(' ')[0]}%`)
      .limit(5);

    if (textMatches && textMatches.length > 0) {
      retrievedVerses = textMatches;
    } else {
      // Fallback: get first 3 verses
      const { data: fallbackMatches } = await supabase
        .from('verses')
        .select('id, english_translation, sanskrit_original, verse_number')
        .limit(3);
        
      if (fallbackMatches) {
        retrievedVerses = fallbackMatches;
      }
    }

    if (retrievedVerses.length === 0) {
      return NextResponse.json({
        answer: "No relevant verses found in the database.",
        citations: [], specializations: [], confidence_note: "No data.", disclaimer: DISCLAIMER, is_emergency: isEmergency
      });
    }

    // 3. Synthesize Answer using OpenAI
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
