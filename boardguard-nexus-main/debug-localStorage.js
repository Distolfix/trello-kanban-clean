// Aggiungi questo script nella console del browser per vedere tutto il localStorage
console.log("=== DEBUG LOCALSTORAGE ===");
console.log("🔑 Tutte le chiavi in localStorage:");
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    console.log(`${key}:`, localStorage.getItem(key));
}

console.log("\n=== CHIAVI SPECIFICHE ===");
console.log("discord_user:", localStorage.getItem('discord_user'));
console.log("staffUsers:", localStorage.getItem('staffUsers'));
console.log("user:", localStorage.getItem('user'));
console.log("currentUser:", localStorage.getItem('currentUser'));
console.log("auth:", localStorage.getItem('auth'));
console.log("session:", localStorage.getItem('session'));