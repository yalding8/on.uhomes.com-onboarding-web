import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    
    // Auth middleware will intercept this redirect and reroute them correctly 
    // according to their supplier status in the DB (NEW -> / , PENDING -> /dashboard)
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(new URL('/login?error=Invalid+Or+Expired+Code', request.url))
}
