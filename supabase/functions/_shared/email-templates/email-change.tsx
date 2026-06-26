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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

const LOGO_URL = 'https://zscnhrnsfsrxbjiuuvtm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração do seu e-mail — Atlas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src={LOGO_URL} alt="Atlas" width="140" style={logo} />
        </Section>
        <Heading style={h1}>Confirme a alteração de e-mail</Heading>
        <Text style={text}>
          Você solicitou a alteração do e-mail da sua conta no Atlas de{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para confirmar:
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Confirmar Alteração
          </Button>
        </Section>
        <Text style={footer}>
          Se você não solicitou essa alteração, proteja sua conta imediatamente.
        </Text>
        <Text style={brand}>© {new Date().getFullYear()} Atlas · Organização Financeira</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', 'Inter', Arial, sans-serif" }
const container = { padding: '0', maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: '#2B4A5C', padding: '28px 40px', textAlign: 'center' as const, borderRadius: '14px 14px 0 0' }
const logo = { margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2B3340', margin: '24px 40px 16px' }
const text = { fontSize: '15px', color: '#6B7280', lineHeight: '1.6', margin: '0 40px 20px' }
const link = { color: '#2B4A5C', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '8px 40px 28px' }
const button = { backgroundColor: '#2B4A5C', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '10px', padding: '14px 32px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#8B7D6B', margin: '0 40px 8px', lineHeight: '1.5' }
const brand = { fontSize: '12px', color: '#A09472', margin: '20px 40px', textAlign: 'center' as const, borderTop: '1px solid #EDE8DF', paddingTop: '16px' }
