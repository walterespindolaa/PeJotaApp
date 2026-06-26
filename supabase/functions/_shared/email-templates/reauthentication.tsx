/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

const LOGO_URL = 'https://zscnhrnsfsrxbjiuuvtm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação — Atlas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Atlas" width="140" style={logo} />
        </Section>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em breve. Se você não solicitou, pode ignorar este e-mail.
        </Text>
        <Text style={brand}>© {new Date().getFullYear()} Atlas · Organização Financeira</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', 'Inter', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#2B4A5C', padding: '28px 40px', textAlign: 'center' as const, borderRadius: '14px 14px 0 0' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2B3340', margin: '24px 40px 16px' }
const text = { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: '0 40px 20px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#2B4A5C', margin: '0 40px 28px', textAlign: 'center' as const, letterSpacing: '4px' }
const footer = { fontSize: '13px', color: '#8B7D6B', margin: '0 40px 8px', lineHeight: '1.5' }
const brand = { fontSize: '12px', color: '#A09472', margin: '20px 40px', textAlign: 'center' as const, borderTop: '1px solid #EDE8DF', paddingTop: '16px' }
