import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT
        ci.id,
        ci.raw_input AS "rawInput",
        ci.detected_source AS "type",
        ci.status,
        ci.title,
        ci.content,
        ci.original_url AS "originalUrl",
        ci.created_at AS "createdAt",
        ci.category,
        ci.tags,
        ci.thumbnail_url AS "thumbnailUrl",
        -- The ingestion pipeline stores its degradation reason here: an item that
        -- arrived with a piece missing must not look identical to a complete one.
        ci.error AS "issue",
        (
          SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
            'id', cv.id,
            'claim', cv.claim,
            'status', cv.status,
            'explanation', cv.explanation,
            'sources', cv.sources
          )), '[]'::json)
          FROM claim_verifications cv
          WHERE cv.item_id = ci.id
        ) AS verifications
      FROM captured_items ci
      ORDER BY ci.created_at DESC;
    `;
    const result = await dbPool.query(query);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching items in API Route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
