/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://zscnhrnsfsrxbjiuuvtm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha — Atlas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Atlas" width="140" style={logo} />
        </Section>
        <Heading style={h1}>Redefinir sua senha</Heading>
        <Text style={text}>
          Recebemos uma solicitação para redefinir a senha da sua conta no Atlas.
          Clique no botão abaixo para criar uma nova senha.
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Redefinir Senha
          </Button>
        </Section>
        <Text style={footer}>
          Se você não solicitou essa alteração, ignore este e-mail. O link expira em 1 hora.
        </Text>
        <Text style={brand}>© {new Date().getFullYear()} Atlas · Organização Financeira</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', 'Inter', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#2B4A5C', padding: '28px 40px', textAlign: 'center' as const, borderRadius: '14px 14px 0 0' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2B3340', margin: '24px 40px 16px' }
const text = { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: '0 40px 20px' }
const buttonSection = { textAlign: 'center' as const, margin: '8px 40px 28px' }
const button = { backgroundColor: '#2B4A5C', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '10px', padding: '14px 32px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#8B7D6B', margin: '0 40px 8px', lineHeight: '1.5' }
const brand = { fontSize: '12px', color: '#A09472', margin: '20px 40px', textAlign: 'center' as const, borderTop: '1px solid #EDE8DF', paddingTop: '16px' }
