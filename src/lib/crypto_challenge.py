"""
Crypto challenge utilities from ctf-re — reverse engineering patterns.
"""
from dataclasses import dataclass
from typing import List, Dict, Optional
import hashlib
import math
import base64


@dataclass
class CryptoChallenge:
    id: str
    name: str
    algorithm: str
    key: bytes = b""
    ciphertext: bytes = b""
    plaintext: bytes = b""
    difficulty: int = 1


def xor_bytes(data: bytes, key: bytes) -> bytes:
    return bytes(d ^ key[i % len(key)] for i, d in enumerate(data))


def caesar_shift(text: str, shift: int) -> str:
    result = []
    for c in text:
        if c.isalpha():
            base = ord('A') if c.isupper() else ord('a')
            result.append(chr((ord(c) - base + shift) % 26 + base))
        else:
            result.append(c)
    return ''.join(result)


def frequency_analysis(ciphertext: str) -> Dict[str, float]:
    freq = {}
    total = sum(1 for c in ciphertext if c.isalpha())
    for c in ciphertext.lower():
        if c.isalpha():
            freq[c] = freq.get(c, 0) + 1
    return {k: v / total for k, v in sorted(freq.items(), key=lambda x: -x[1])}


def find_xor_key(ciphertext: bytes, expected_english: bool = True) -> List[bytes]:
    candidates = []
    for key_byte in range(256):
        decrypted = bytes(b ^ key_byte for b in ciphertext)
        if expected_english:
            score = sum(1 for b in decrypted if 32 <= b <= 126)
            if score > len(decrypted) * 0.8:
                candidates.append(bytes([key_byte]))
    return candidates


def md5_hash(data: str) -> str:
    return hashlib.md5(data.encode()).hexdigest()


def sha256_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def base64_encode(data: str) -> str:
    return base64.b64encode(data.encode()).decode()


def base64_decode(data: str) -> str:
    return base64.b64decode(data).decode()


def rsa_decrypt(ciphertext: int, d: int, n: int) -> int:
    return pow(ciphertext, d, n)


def rsa_encrypt(plaintext: int, e: int, n: int) -> int:
    return pow(plaintext, e, n)


def euler_totient(p: int, q: int) -> int:
    return (p - 1) * (q - 1)


def extended_gcd(a: int, b: int) -> tuple:
    if a == 0:
        return b, 0, 1
    gcd, x1, y1 = extended_gcd(b % a, a)
    return gcd, y1 - (b // a) * x1, x1


def mod_inverse(e: int, phi: int) -> int:
    gcd, x, _ = extended_gcd(e, phi)
    if gcd != 1:
        raise ValueError("No modular inverse")
    return x % phi


def solve_rsa(e: int, n: int, ciphertext: int) -> int:
    # Factor n (simplified - only works for small n)
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0:
            p, q = i, n // i
            phi = euler_totient(p, q)
            d = mod_inverse(e, phi)
            return rsa_decrypt(ciphertext, d, n)
    raise ValueError("Could not factor n")
