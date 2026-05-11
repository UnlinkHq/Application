// WARNING: This API key is embedded in the APK and can be extracted by decompiling.
// Before Play Store release, replace this call with a backend proxy (e.g. Vercel Edge Function)
// so the key lives server-side and is never shipped with the app.
const RESEND_API_KEY = 're_N6uTZ7U8_5xDH88K6JuekUqNDGTwrL4pZ';
const RESEND_FROM = 'Unlink <auth@getunlink.com>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'EMAIL_SEND_FAILED');
    }
}

export async function sendMomTestUnlockCode(to: string, otp: string): Promise<void> {
    await sendEmail(
        to,
        'MOM TEST: UNLOCK VERIFICATION CODE',
        `<div style="font-family: sans-serif; padding: 20px; color: #000; border: 1px solid #eee;">
            <h2 style="letter-spacing: 2px; text-transform: uppercase;">Unlink_Protocol</h2>
            <p>A request has been made to terminate an active focus session.</p>
            <p>Please provide this code to the user <b>only</b> if they have completed their original intent:</p>
            <div style="background: #f9f9f9; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="font-size: 48px; letter-spacing: 15px; margin: 0; color: #000;">${otp}</h1>
            </div>
            <p style="color: #666; font-size: 11px; text-transform: uppercase;">Mode: AirTight Lockdown (Mom Test)</p>
        </div>`
    );
}

export async function sendFocusSessionUnlockCode(to: string, otp: string): Promise<void> {
    await sendEmail(
        to,
        'MOM TEST: UNLINK VERIFICATION CODE',
        `<div style="font-family: sans-serif; padding: 20px; color: #000;">
            <h2 style="letter-spacing: 2px;">UNLINK PROTOCOL</h2>
            <p>Your verification code to terminate the focus session is:</p>
            <h1 style="font-size: 48px; letter-spacing: 15px; margin: 30px 0;">${otp}</h1>
            <p style="color: #666; font-size: 12px;">This code was requested via the Mom Test protocol.</p>
        </div>`
    );
}

export async function sendSetupVerificationCode(to: string, otp: string): Promise<void> {
    await sendEmail(
        to,
        'MOM TEST: SETUP VERIFICATION CODE',
        `<div style="font-family: sans-serif; padding: 20px; color: #000;">
            <h2 style="letter-spacing: 2px;">UNLINK SETUP</h2>
            <p>You have been chosen as a Trusted Contact for an Unlink Focus Session.</p>
            <p>Use this code to verify your identity:</p>
            <h1 style="font-size: 32px; letter-spacing: 10px; margin: 20px 0;">${otp}</h1>
            <p style="color: #666; font-size: 11px;">If you didn't expect this, please ignore this email.</p>
        </div>`
    );
}
