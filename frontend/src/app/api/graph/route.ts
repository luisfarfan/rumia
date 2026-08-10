import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/db';

export async function GET() {
  try {
    const nodesQuery = 'SELECT id, name, label, properties FROM nodes;';
    const edgesQuery = `
      SELECT 
        e.id, 
        n1.name AS "source", 
        n2.name AS "target", 
        e.type AS "label", 
        e.properties 
      FROM edges e
      JOIN nodes n1 ON e.source_node = n1.id
      JOIN nodes n2 ON e.target_node = n2.id;
    `;

    const [nodesResult, edgesResult] = await Promise.all([
      dbPool.query(nodesQuery),
      dbPool.query(edgesQuery),
    ]);

    // Map nodes to structure where id is the name for react-force-graph compatibility
    const nodes = nodesResult.rows.map((node) => ({
      id: node.name,
      name: node.name,
      label: node.label,
      properties: node.properties,
    }));

    const links = edgesResult.rows;

    return NextResponse.json({ nodes, links });
  } catch (error) {
    console.error('Error fetching graph in API Route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
