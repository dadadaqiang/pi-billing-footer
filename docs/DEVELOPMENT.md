# Development

## Setup

```bash
git clone <repo>
cd pi-billing-footer

# No build step required — the extension is plain TypeScript.
# Copy to Pi's extension directory to test:
cp extension/pi-billing-footer.ts ~/.pi/agent/extensions/pi-billing-footer.ts
```

## Structure

| Path | Purpose |
|------|---------|
| `extension/pi-billing-footer.ts` | Core extension (single file) |
| `skill/pi-billing-footer/` | AI skill for conversation‑based setup |
| `skill/pi-billing-footer/scripts/` | Helper CLI scripts |
| `skill/pi-billing-footer/references/` | Pricing & provider template docs |
| `examples/` | Sample config files |
| `install.sh` | One‑line installation script |

## Testing

1. Copy the extension to `~/.pi/agent/extensions/`
2. Restart Pi
3. Run `/billing` to verify it loads
4. Run `/billing help` to see all subcommands

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) (coming soon).
