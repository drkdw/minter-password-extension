// ===== Theme System =====
const THEME_ICONS = {
    system: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    dark: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
};

const THEME_CYCLE = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };

let currentTheme = 'system';

/**
 * Apply the given theme to the document.
 *
 * @param {string} theme - One of 'system', 'light', 'dark'.
 */
function applyTheme(theme) {
    const root = document.documentElement;
    if ('system' === theme) {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', theme);
    }

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = THEME_ICONS[theme];
        btn.title = `Theme: ${THEME_LABELS[theme]}`;
    }
}

/**
 * Cycle to the next theme and persist the choice.
 */
function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    currentTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    applyTheme(currentTheme);
    chrome.storage.local.set({ theme: currentTheme });
}

// Load persisted theme on startup
chrome.storage.local.get(['theme'], function(result) {
    if (result.theme && THEME_CYCLE.includes(result.theme)) {
        currentTheme = result.theme;
    }
    applyTheme(currentTheme);
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
    if ('system' === currentTheme) {
        applyTheme('system');
    }
});

// ===== External Links =====
document.addEventListener('click', function(event) {
    const link = event.target.closest('a[target="_blank"]');
    if (link) {
        event.preventDefault();
        chrome.tabs.create({ url: link.href });
    }
});

// ===== Crypto-secure random =====

/**
 * Return a cryptographically secure random integer in [0, max).
 * Uses crypto.getRandomValues() — built into the browser, works offline.
 *
 * @param {number} max
 * @return {number}
 */
function secureRandomInt(max) {
    const array = new Uint32Array(1);
    // Rejection sampling eliminates modulo bias.
    const limit = 0x100000000 - (0x100000000 % max);
    do { crypto.getRandomValues(array); } while (array[0] >= limit);
    return array[0] % max;
}

// ===== Password Generator =====
document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('theme-toggle').addEventListener('click', cycleTheme);

    /**
     * Generate a password based on current options.
     */
    function generatePassword() {
        const uppercase = document.getElementById('uppercase-checkbox').checked;
        let   lowercase = document.getElementById('lowercase-checkbox').checked;
        const numbers   = document.getElementById('number-checkbox').checked;
        const symbols   = document.getElementById('symbol-checkbox').checked;
        const rainbow   = document.getElementById('rainbow-checkbox').checked;

        // Ensure at least one type is selected
        if (!uppercase && !lowercase && !numbers && !symbols) {
            lowercase = true;
            document.getElementById('lowercase-checkbox').checked = true;
        }

        // Build charset
        let charset = '';
        if (uppercase) { charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; }
        if (lowercase) { charset += 'abcdefghijklmnopqrstuvwxyz'; }
        if (numbers)   { charset += '0123456789'; }
        if (symbols)   { charset += '!@#$%^&*()_+'; }

        const length = parseInt(document.getElementById('length-slider').value, 10);
        let password = '';

        // Guarantee at least one char from each selected type
        if (uppercase) { password += getRandomCharacter('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); }
        if (lowercase) { password += getRandomCharacter('abcdefghijklmnopqrstuvwxyz'); }
        if (numbers)   { password += getRandomCharacter('0123456789'); }
        if (symbols)   { password += getRandomCharacter('!@#$%^&*()_+'); }

        // Fill remaining length
        const remaining = length - password.length;
        for (let i = 0; i < remaining; i++) {
            password += charset.charAt(secureRandomInt(charset.length));
        }

        password = randomizePositions(password);

        // Build colored HTML
        let html = '';
        for (let j = 0; j < password.length; j++) {
            const char = password.charAt(j);
            if (rainbow) {
                html += '<span style="color: hsl(' + (j * 10) + ', 100%, 50%);">' + char + '</span>';
            } else if (numbers && /\d/.test(char)) {
                html += '<span style="color: #4a90d9;">' + char + '</span>';
            } else if (symbols && /[^\w\s]|_/.test(char)) {
                html += '<span style="color: #e05c5c;">' + char + '</span>';
            } else {
                html += char;
            }
        }

        document.getElementById('password-display').innerHTML = html;

        // Strength meter — based on Shannon entropy (bits)
        let charsetSize = 0;
        if (uppercase) charsetSize += 26;
        if (lowercase) charsetSize += 26;
        if (numbers)   charsetSize += 10;
        if (symbols)   charsetSize += 12;

        const entropy = length * Math.log2(charsetSize);

        let strength = 0;
        let strengthClass = 'progress-bar';
        if (entropy >= 28) { strength = 25;  strengthClass = 'progress-bar bg-danger';  } // weak
        if (entropy >= 36) { strength = 50;  strengthClass = 'progress-bar bg-warning'; } // fair
        if (entropy >= 60) { strength = 75;  strengthClass = 'progress-bar bg-success'; } // good
        if (entropy >= 80) { strength = 100; strengthClass = 'progress-bar bg-strong';  } // strong

        const meter = document.getElementById('strength-meter');
        meter.style.width = strength + '%';
        meter.className = strengthClass;
    }

    /**
     * Return a cryptographically secure random character from the given string.
     *
     * @param {string} charset
     * @return {string}
     */
    function getRandomCharacter(charset) {
        return charset.charAt(secureRandomInt(charset.length));
    }

    /**
     * Fisher-Yates shuffle on a string using crypto-secure random.
     *
     * @param {string} str
     * @return {string}
     */
    function randomizePositions(str) {
        const arr = str.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = secureRandomInt(i + 1);
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr.join('');
    }

    /**
     * Update the length display next to the slider.
     */
    function updateLengthDisplay() {
        const length = document.getElementById('length-slider').value;
        document.getElementById('length-display').textContent = length;
    }

    /**
     * Show the "copied" toast notification.
     */
    function showCopiedNotification() {
        const el = document.getElementById('password-copied');
        el.textContent = 'Password copied to clipboard.';
        el.classList.add('copied');
        setTimeout(function() {
            el.classList.remove('copied');
        }, 3000);
    }

    /**
     * Show an error toast notification.
     *
     * @param {string} message
     */
    function showErrorNotification(message) {
        const el = document.getElementById('password-copied');
        el.textContent = message;
        el.classList.add('copied', 'error');
        setTimeout(function() {
            el.classList.remove('copied', 'error');
        }, 3000);
    }

    /**
     * Copy the current password (plain text) to clipboard.
     */
    function copyPassword() {
        const password = document.getElementById('password-display').textContent;
        navigator.clipboard.writeText(password)
            .then(showCopiedNotification)
            .catch(function() {
                showErrorNotification('Copy failed — try again.');
            });
    }

    /**
     * Persist current option values to chrome.storage.local.
     */
    function savePreferences() {
        const prefs = {
            length:    parseInt(document.getElementById('length-slider').value, 10),
            uppercase: document.getElementById('uppercase-checkbox').checked,
            lowercase: document.getElementById('lowercase-checkbox').checked,
            numbers:   document.getElementById('number-checkbox').checked,
            symbols:   document.getElementById('symbol-checkbox').checked,
            rainbow:   document.getElementById('rainbow-checkbox').checked
        };
        chrome.storage.local.set({ prefs: prefs });
    }

    /**
     * Apply stored preferences to the UI. Falls back to HTML defaults
     * when no preferences are stored yet.
     *
     * @param {function} callback - Called after prefs are applied.
     */
    function loadPreferences(callback) {
        chrome.storage.local.get(['prefs'], function(result) {
            const prefs = result.prefs;
            if (prefs) {
                if (typeof prefs.length === 'number') {
                    document.getElementById('length-slider').value = prefs.length;
                }
                if (typeof prefs.uppercase === 'boolean') {
                    document.getElementById('uppercase-checkbox').checked = prefs.uppercase;
                }
                if (typeof prefs.lowercase === 'boolean') {
                    document.getElementById('lowercase-checkbox').checked = prefs.lowercase;
                }
                if (typeof prefs.numbers === 'boolean') {
                    document.getElementById('number-checkbox').checked = prefs.numbers;
                }
                if (typeof prefs.symbols === 'boolean') {
                    document.getElementById('symbol-checkbox').checked = prefs.symbols;
                }
                if (typeof prefs.rainbow === 'boolean') {
                    document.getElementById('rainbow-checkbox').checked = prefs.rainbow;
                }
            }
            callback();
        });
    }

    // Regenerate on any input change
    document.querySelectorAll(
        '#uppercase-checkbox, #lowercase-checkbox, #number-checkbox, #symbol-checkbox, #rainbow-checkbox, #length-slider'
    ).forEach(function(el) {
        el.addEventListener('input', function() {
            generatePassword();
            updateLengthDisplay();
            savePreferences();
        });
    });

    // Button clicks
    document.getElementById('generate-icon').addEventListener('click', generatePassword);
    document.getElementById('copy-button').addEventListener('click', copyPassword);

    // Restore saved preferences, then generate the first password
    loadPreferences(function() {
        updateLengthDisplay();
        generatePassword();
    });
});
