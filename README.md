# Registro Quadrato Ufficiali – Nave Trieste (L 9890)

App per tablet (Android e iPad) che fa da registro di cassa del bar del Quadrato Ufficiali.

- **Funziona completamente offline**: tutti i dati restano salvati sul tablet.
- **Gratis**: nessun abbonamento, nessuno store, nessun account sviluppatore.
- **Aggiornamenti**: a ogni avvio, se c'è connessione, l'app controlla se esiste una nuova versione e chiede se installarla.

Tecnicamente è una *Progressive Web App* (PWA): si installa dal browser e poi si apre dall'icona come una normale app.

---

## 1. Installazione sul tablet

Indirizzo dell'app (dopo la pubblicazione, vedi § 7):
**https://ninojapan.github.io/AppQuadrato/**

**Android** (Chrome)
1. Aprire l'indirizzo con **Chrome**.
2. Menu **⋮** → **Installa app** (o "Aggiungi a schermata Home").
3. Aprire l'app dall'icona con lo stemma di Nave Trieste.

**iPad** (Safari)
1. Aprire l'indirizzo con **Safari**.
2. Pulsante **Condividi** → **Aggiungi alla schermata Home**.
3. Aprire l'app dall'icona.

Serve internet solo per l'installazione. Dopo, l'app funziona anche senza rete.

## 2. Primo avvio

Al primo avvio si impostano:
- il **nome della nave**, che compare sotto il titolo;
- la **password AMMINISTRATORE**, che dà accesso a tutte le funzioni;
- la **password OPERATORE**, che serve solo a registrare i consumi.

Poi l'app mostra un **codice di recupero**. Va annotato e conservato: serve a reimpostare la password amministratore se viene dimenticata.

## 3. Uso quotidiano (operatore)

1. All'apertura si inserisce la password, con il tastierino o con la tastiera.
2. La home mostra **tutte le tessere** nella forma *GRADO COGNOME Iniziale.* (es. `T.V. ROSSI M.`). I riquadri, in ordine alfabetico per cognome, si ridimensionano da soli per stare tutti sullo schermo. Si può cercare per nome.
3. Si tocca un nominativo e si apre la finestra dei prodotti. Con **+** e **−** si scelgono le quantità; toccando l'immagine del prodotto se ne aggiunge uno.
4. Si preme **CASSA**: il consumo viene salvato e l'app torna subito alla home, senza attese.

L'operatore vede tre sezioni in basso:
- **Cassa**: la home con le tessere.
- **Movimenti**: l'elenco dei consumi. Se si è sbagliato persona o prodotto, si può **Modificare** l'ordine (si riapre con le quantità già inserite) o **Annullarlo**. Saldo e magazzino vengono ricalcolati da soli. L'operatore può correggere solo i consumi delle ultime **24 ore** (valore modificabile in Impostazioni); ricariche e magazzino restano all'amministratore.
- **Statistiche**: le stesse statistiche dell'amministratore, senza la verifica di inventario.

Colori del saldo: **verde** = credito, **giallo** = saldo basso, **arancione** = in debito, **rosso con lucchetto** = tessera bloccata.

### Regola del debito
Una tessera può andare in debito fino a **1,00 €** (valore modificabile in Impostazioni). Raggiunto il limite, la tessera è **bloccata**: non si possono registrare consumi finché l'amministratore non la ricarica. Un acquisto che supererebbe il limite non viene accettato.

### Prodotti a unità (magazzino)
Per i prodotti con **gestione quantità** attiva (es. cialde del caffè) l'app mostra quante unità restano. Quando finiscono, il prodotto compare come **ESAURITO** e non si può vendere.

## 4. Funzioni amministratore

Si entra con il pulsante **Admin** in alto, inserendo la password amministratore. Dopo 5 minuti di inattività l'app torna da sola in modalità operatore (tempo modificabile).

| Sezione | Cosa si fa |
|---|---|
| **Tessere** | Registrare tessere (Grado, Cognome, Nome: salvati sempre in MAIUSCOLO), **ricaricare** il credito, fare **rimborsi** (es. ufficiale che sbarca), vedere l'**estratto conto**, modificare o eliminare. Toccando il cestino si apre una conferma che evidenzia in verde il **credito residuo** o in rosso il **debito non saldato**; l'eliminazione resta registrata nei movimenti come *Chiusura tessera*. Solo l'amministratore ricarica. |
| **Prodotti** | Nome, prezzo, **foto facoltativa** (anche scattata col tablet), gestione quantità, posizione nell'elenco, visibile/nascosto. **Carico** di magazzino e **Inventario** (conteggio fisico): solo l'amministratore aumenta lo stock. |
| **Movimenti** | Storico completo filtrabile per periodo, tipo e tessera. **Modifica** o **annullamento** di qualsiasi consumo e **storno** di ricariche, rimborsi e movimenti di magazzino: saldo e magazzino vengono ripristinati. Esportazione **CSV** per Excel. |
| **Statistiche** | Consumi del periodo, media per scontrino, ricariche, contante incassato, credito residuo e debiti; grafico dei consumi per giorno o mese, prodotti più venduti, fasce orarie, maggiori consumatori; **verifica magazzino** (caricati − venduti ± inventario = rimanenza) da confrontare con il conteggio fisico. |
| **Impostazioni** | Nome nave e logo, debito massimo, soglia saldo basso, uscita automatica admin, ore entro cui l'operatore può modificare gli ordini, password, codice di recupero, **backup / ripristino**, verifica aggiornamenti. |

### Verifica di cassa e magazzino
- **Contante incassato** (Statistiche) = ricariche − rimborsi del periodo: deve corrispondere ai soldi in cassa.
- **Verifica magazzino**: per ogni prodotto a unità si vedono le unità caricate e vendute e la rimanenza calcolata. Con **Verifica / Inventario** si inserisce la quantità contata fisicamente e l'app mostra subito la differenza, in pezzi e in euro.

## 5. Backup (importante)

I dati esistono **solo su quel tablet**. Se il tablet si rompe o l'app viene cancellata, i dati si perdono. Per questo:
- **Impostazioni → Scarica backup** (oppure **Condividi backup** per inviarlo via mail, AirDrop o File) **almeno una volta a settimana**;
- se l'ultimo backup ha più di 7 giorni, l'app lo ricorda all'accesso dell'amministratore;
- **Ripristina da file** carica un backup sullo stesso tablet o su uno nuovo. Il backup contiene anche le password.

Ogni tablet ha un registro indipendente: i dati non si sincronizzano tra tablet diversi.

## 6. Aggiornamenti

All'avvio, se il tablet è connesso, l'app controlla se è stata pubblicata una nuova versione. In quel caso la scarica in background e chiede:

> *È disponibile una nuova versione dell'app. Vuoi installarla adesso?* **[Più tardi] [Installa]**

L'aggiornamento non tocca i dati (tessere, prodotti, movimenti). Senza connessione l'app parte normalmente con la versione già installata. Da **Impostazioni → Verifica aggiornamenti** il controllo si può fare anche a mano.

## 7. Pubblicazione (una sola volta, gratis)

L'app viene pubblicata su **GitHub Pages**. Il workflow `.github/workflows/pubblica.yml` la ripubblica da solo a ogni modifica del ramo `main`.

1. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Unire il codice nel ramo `main`. Parte la pubblicazione automatica (scheda **Actions**).
3. Dopo un paio di minuti l'app è su `https://ninojapan.github.io/AppQuadrato/`.

Il codice pubblicato non contiene dati né password: questi restano solo sui tablet.

### Pubblicare una nuova versione
1. Modificare i file in `app/`.
2. In `app/version.json` aumentare `version` (es. `1.0.1`) e scrivere le novità in `notes`: compaiono nella richiesta di aggiornamento.
3. Fare il push su `main`. Al successivo avvio con connessione, i tablet propongono l'aggiornamento.

Il numero di *build* si calcola da solo dal contenuto dei file: se i file non cambiano, ai tablet non viene proposto nessun aggiornamento.

## 8. Logo

Il logo di Nave Trieste è in `assets-src/logo-nave-trieste.webp`. Da questo file vengono generati il logo dell'app (`app/assets/logo.png`) e le icone (`app/icons/`). Per rigenerarli, ad esempio con un logo diverso:

```bash
npx playwright install chromium
node scripts/make-icons.mjs percorso/del/logo.png
```

Il logo si può cambiare anche solo su un tablet, da **Impostazioni → Carica logo**.

## 9. Sviluppo e prova sul computer

Serve Node.js. Non ci sono dipendenze da installare.

```bash
node scripts/build.mjs
```

```bash
python3 -m http.server 8080 --directory dist
```

Poi aprire `http://localhost:8080`.

### Struttura

```
app/                  codice dell'app (HTML, CSS, JavaScript senza framework)
  index.html
  sw.js               service worker: funzionamento offline e aggiornamenti
  version.json        versione e note di rilascio
  js/store.js         regole di cassa (saldi, debito massimo, stock, storni, password)
  js/db.js            archivio locale IndexedDB
  js/views/           schermate (home, consumo, tessere, prodotti, movimenti, statistiche, impostazioni)
assets-src/           logo originale
scripts/build.mjs     prepara la cartella dist/ da pubblicare
scripts/make-icons.mjs genera logo e icone
```

Le password sono salvate solo come impronta SHA-256 con sale. Gli importi sono gestiti in centesimi, per evitare errori di arrotondamento.
