import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ContractViewer } from '@/components/signing/ContractViewer'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Readonly error handling in Server Components
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-secondary)]">
        <p className="text-[var(--color-text-primary)]">Please login to access your dashboard.</p>
      </div>
    )
  }

  // Fetch Supplier profile linked to this user identity
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, company_name, status')
    .eq('user_id', user.id)
    .single()

  // Fetch pending active contracts for this supplier to power ContractViewer
  let contract = null
  if (supplier?.id) {
    const { data: contractData } = await supabase
      .from('contracts')
      .select('id, status, embedded_signing_url')
      .eq('supplier_id', supplier.id)
      .not('status', 'eq', 'CANCELED')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      
    contract = contractData
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-8">
      <div className="max-w-4xl mx-auto bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-[var(--color-border)]">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Welcome, {supplier?.company_name || user.email}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            This is your secure onboarding portal.
          </p>
        </div>
        
        <div className="p-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Pending Actions
          </h2>
          
          {contract ? (
            <ContractViewer 
               contractId={contract.id}
               supplierId={supplier!.id}
               signingUrl={contract.embedded_signing_url || '#'}
               status={contract.status}
            />
          ) : (
            <div className="p-4 bg-[var(--color-primary-light)] rounded-xl border border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-primary)] font-medium">
                Your partnership agreement is being prepared by our BD team. 
                You will receive an email notification once it is available for signature.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
