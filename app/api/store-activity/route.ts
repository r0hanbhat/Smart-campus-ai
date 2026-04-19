import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body || {};

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity received without cloud memory storage',
    });
  } catch (error) {
    console.error('Store Activity Error:', error);
    return NextResponse.json(
      { error: 'Failed to store activity' },
      { status: 500 }
    );
  }
}
