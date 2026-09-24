# Otevírání nástrojů tools.digiday.cz z NEXu

Tlačítko v NEXu otevře nástroj (např. předávací protokol) rovnou přihlášený
a s předvyplněnými údaji zákazníka.

## Tvar odkazu

```
<URL nástroje>#nex=<token>&<klíč>=<hodnota>&<klíč>=<hodnota>…
```

- Vše je za `#`, takže se nic neposílá na server a údaje nekončí v logách.
- `nex` = podepsaný token přihlášení (viz níže). Bez platného tokenu nástroj přesměruje na přihlášení.
- Ostatní parametry se zapíšou do formuláře. Prázdné hodnoty stačí vynechat, taková pole zůstanou prázdná.
- Hodnoty kódovat přes `rawurlencode` (UTF-8).

## Token

`base64url(JSON {"u": username, "e": expirace v ms}) + "." + base64url(HMAC-SHA256(payload, SSO_SECRET))`

`SSO_SECRET` je stejný jako v env projektu digiday-tools-auth na Vercelu. Předává se mimo repo.

```php
define('DIGIDAY_TOOLS_SSO_SECRET', '…');

function b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function digidayToolsLink($url, $username, array $prefill = []) {
    $payload = b64url(json_encode(['u' => $username, 'e' => (time() + 12 * 3600) * 1000]));
    $token = $payload . '.' . b64url(hash_hmac('sha256', $payload, DIGIDAY_TOOLS_SSO_SECRET, true));
    $prefill = array_filter($prefill, fn($v) => $v !== null && $v !== '');
    return $url . '#nex=' . rawurlencode($token)
        . ($prefill ? '&' . http_build_query($prefill, '', '&', PHP_QUERY_RFC3986) : '');
}

// příklad
echo digidayToolsLink(
    'https://digidayczech.github.io/digiday-pdf/predavaci-protokol.html',
    $currentUser['username'],
    [
        'subjekt'  => 'Obec Lažany',
        'sidlo'    => 'Lažany čp. 129, 679 22 Lipůvka',
        'zastupce' => 'Jana Juncová DiS., starostka',
        'web'      => 'www.obeclazany.eu',
        'misto'    => 'V Lažanech',
    ]
);
```

Odkaz generovat na serveru až při zobrazení stránky (token platí 12 h), secret nikdy neposílat do prohlížeče.

## Nástroje a klíče

### Předávací protokol QARO
`https://digidayczech.github.io/digiday-pdf/predavaci-protokol.html`

| klíč | pole |
|---|---|
| `subjekt` | Uživatel (název obce / subjektu) |
| `sidlo` | Sídlo |
| `zastupce` | Zastoupený (jméno, funkce) |
| `web` | Web (adresa systému) |
| `misto` | Místo podpisu zákazníka, např. „V Lažanech" |
| `datum` | Datum, formát `YYYY-MM-DD` (bez něj dnešní) |

### Předávací protokol B2B
`https://digidayczech.github.io/digiday-pdf/predavaci-protokol-b2b.html`

| klíč | pole |
|---|---|
| `projekt` | Název projektu |
| `popis` | Popis projektu |
| `subjekt` | Název firmy |
| `ico` | IČO |
| `dic` | DIČ |
| `sidlo` | Sídlo |
| `zastupce` | Zastoupený (jméno, funkce) |
| `misto` | Místo podpisu zákazníka |
| `datum` | Datum, formát `YYYY-MM-DD` |
| `smlouva` | Číslo smlouvy |

## Přidání dalšího nástroje

Na stránce musí být `nex-guard.js` (první script v `<head>`). Polím stačí přidat
`data-prefill="<klíč>"` a zapsat klíče do této tabulky.
