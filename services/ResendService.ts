const EMAIL_PROXY_URLS = [
    'https://www.getunlink.com/api/send-email',
    'https://unlink-productivity-app.vercel.app/api/send-email',
];

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
    let lastError: Error = new Error('EMAIL_SEND_FAILED');

    for (const url of EMAIL_PROXY_URLS) {
        console.log('[ResendService] POST', url, 'to:', to);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, html }),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('[ResendService] HTTP', response.status, text);
                lastError = new Error(text || 'EMAIL_SEND_FAILED');
                continue;
            }

            console.log('[ResendService] OK via', url);
            return;
        } catch (networkErr: any) {
            console.error('[ResendService] Network error hitting', url, networkErr?.message);
            lastError = networkErr;
        }
    }

    throw lastError;
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

export async function sendIntegrityBreakAlert(to: string, sessionTitle: string): Promise<void> {
    await sendEmail(
        to,
        'UNLINK: A FOCUS SESSION WAS INTERRUPTED',
        `<div style="font-family: sans-serif; padding: 20px; color: #000;">
            <h2 style="letter-spacing: 2px; text-transform: uppercase;">Unlink Protocol</h2>
            <p>The focus session <b>${sessionTitle}</b> was <b>interrupted before it finished</b>.</p>
            <p>The Unlink app was force-stopped or closed by the phone during the session, so blocking stopped early. You're receiving this because you're set as the accountability contact.</p>
        </div>`
    );
}
