#!/usr/bin/env python3
"""Lê o Apple Partition Map de um .dmg feito pelo xorriso e imprime
'<offset_bytes> <tamanho_bytes>' da partição Apple_HFS."""
import struct, sys
f = open(sys.argv[1], 'rb')
blk = struct.unpack('>H', f.read(4)[2:4])[0]          # bloco 0: 'ER' + tamanho do bloco
f.seek(blk); n = None; i = 1
while True:
    f.seek(i * blk); e = f.read(blk)
    if e[:2] != b'PM': break
    cnt, start, size = struct.unpack('>III', e[4:16])
    ptype = e[48:80].split(b'\0')[0]
    if ptype == b'Apple_HFS':
        print(start * blk, size * blk); sys.exit(0)
    n = cnt; i += 1
    if i > n: break
sys.exit('sem partição Apple_HFS')
