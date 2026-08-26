# Environment Setup Guide

## API Configuration via Environment Variables

Instead of manually entering API credentials in the Connect tab each time, you can store them in a `.env.local` file that's automatically loaded when the app starts.

### Setup Steps

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` and add your credentials:**
   ```env
   VITE_API_BASE_URL=https://vpce-xxxx.execute-api.us-east-1.vpce.amazonaws.com/develop
   VITE_API_ID=your-api-id-here
   VITE_API_KEY=your-secret-api-key-here
   VITE_AGENT_ID=clarvo-rag-v1
   VITE_WINDOW_DAYS=30
   ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

### Features

✅ **Auto-loaded on app start** - No need to enter credentials every time
✅ **Secure** - `.env.local` is git-ignored and never committed
✅ **Visible in UI** - The Connect tab shows which fields are loaded from `.env`
✅ **Overridable** - You can still change values in the UI if needed
✅ **Optional** - Leave fields empty to skip auto-loading that field

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | ✓ | VPC endpoint URL (e.g., `https://vpce-xxxx.execute-api.us-east-1.vpce.amazonaws.com/develop`) |
| `VITE_API_ID` | ✓ | API Gateway ID (sent as `x-apigw-api-id` header) |
| `VITE_API_KEY` | ✓ | API Key (sent as `x-api-key` header) - **KEEP THIS SECRET** |
| `VITE_AGENT_ID` | - | Agent ID (default: `clarvo-rag-v1`) |
| `VITE_WINDOW_DAYS` | - | Query window in days (default: `30`) |

### Security Notes

⚠️ **Important:**
- `.env.local` is git-ignored - it won't be committed to version control
- The API key is stored in memory only during your session
- A page refresh clears the key from memory
- Never commit `.env.local` to git
- Never share your `.env.local` file

### Vite Environment Variables

All variables must start with `VITE_` to be exposed to the frontend app. This is a Vite security feature that prevents accidental exposure of backend secrets.

### Troubleshooting

**Variables not loading?**
- Make sure the file is named `.env.local` (not `.env` or `.env.development`)
- Restart your dev server after creating/modifying `.env.local`
- Check that variable names start with `VITE_`
- Verify values have no extra spaces or quotes

**Values showing as undefined?**
- Check the browser console for any errors
- Ensure the dev server was restarted after creating `.env.local`
- Verify the syntax is correct (no trailing spaces, valid format)
