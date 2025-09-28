# Trello Kanban Board - Claude Instructions

## ⚠️ IMPORTANTE: Istruzioni per Claude

**Claude deve sempre lavorare su trello.enginemc.it (server remoto) e MAI in locale**

### 🎯 Workflow Obbligatorio per Claude

1. **Lavoro Solo Remoto**: Tutte le modifiche devono essere fatte direttamente su `/var/www/trello`
2. **Git Automatico**: Dopo OGNI modifica al codice:
   ```bash
   git add .
   git commit -m "descrizione modifica"
   git push origin main
   ```
3. **Esclusioni Git**: NON committare mai token Discord o file sensibili
4. **Riavvio Servizi**: Dopo modifiche significative:
   ```bash
   sudo systemctl reload nginx
   pm2 restart all
   ```

### 🚫 File da NON Committare
- `.env` (contiene token Discord)
- `*.log`
- `node_modules/`
- `*.db`, `*.db-shm`, `*.db-wal`

---

## 🚀 Applicazione Trello Kanban Board

Una moderna applicazione Kanban board con autenticazione Discord per la gestione collaborativa di progetti.

### Caratteristiche
- **Autenticazione Discord OAuth2** - Login sicuro tramite Discord
- **Sistema di ruoli** - Admin, Moderatori e Utenti predefiniti
- **Drag & Drop** - Interfaccia intuitiva per la gestione delle card
- **Database SQLite** - Persistenza dei dati con better-sqlite3
- **Commenti e allegati** - Collaborazione completa sulle card
- **Monitoraggio staff** - Integrazione con bot Discord per presenza real-time
- **Design responsive** - Interfaccia moderna con shadcn/ui

### Tecnologie
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite con better-sqlite3
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Discord OAuth2
- **Real-time**: Discord Bot per monitoring staff

### Struttura del progetto
```
/var/www/trello/
├── boardguard-nexus-main/     # Sorgenti dell'applicazione
├── server.ts                  # Server Express principale
├── discord-bot.js            # Bot Discord per monitoraggio
├── .env                      # Configurazione ambiente (NOT in git)
└── assets/                   # File statici build
```

### Configurazione Environment
Il file `.env` contiene variabili sensibili che NON devono essere committate:
```env
# Security
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production

# Discord OAuth
DISCORD_CLIENT_SECRET=your_discord_client_secret
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_DISCORD_REDIRECT_URI=https://trello.enginemc.it/auth/discord/callback
VITE_DISCORD_GUILD_ID=your_guild_id
VITE_DISCORD_ADMIN_ROLE_ID=your_admin_role_id
VITE_DISCORD_MOD_ROLE_ID=your_mod_role_id

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token

# Server
PORT=3001
ALLOWED_ORIGINS=https://trello.enginemc.it

# Database
DB_PATH=./kanban.db
```

### Comandi di Sviluppo
```bash
# Installare dipendenze
npm install

# Avviare server development
npm run dev

# Build per produzione
npm run build

# Avviare server produzione
npm start

# Server principale
PORT=3001 npx tsx server.ts

# Bot Discord (opzionale)
node discord-bot.js
```

### Build e Deploy
```bash
cd boardguard-nexus-main
npm run build
cp -r dist/* ../
```

### Permessi Utente
- **Admin**: Accesso completo, gestione liste e impostazioni
- **Mod**: Può muovere card verso liste private (closed/hidden)
- **Default**: Solo visualizzazione liste pubbliche (open)

### Database
Il database SQLite contiene:
- **Boards**: Configurazione delle board
- **Lists**: Liste kanban con tipi (open/closed/hidden)
- **Cards**: Card con descrizioni, date, labels, allegati
- **Comments**: Sistema di commenti per le card
- **Users**: Utenti con ruoli Discord
- **Actions**: Storia delle azioni per audit trail

### URL di Produzione
https://trello.enginemc.it

---

*Questo README serve come guida per Claude per garantire il corretto workflow di deployment e le pratiche di sicurezza.*
