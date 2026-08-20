"""Enumerate all RoomDef names across every .lotheader (validated 256-cell format).
Format per cell:
  "LOTH" | u32 version | u32 tileCount | tileCount*(string\n)
  | i32 w | i32 h | i32 u0 | i32 u1 | i32 nRooms
  per room: name\n | i32 floor | i32 nRects | nRects*(i32 x,y,w,h) | i32 trailing
worldX = cellX*256 + roomX ; worldY = cellY*256 + roomY
"""
import struct, os, glob, sys, collections

MAP = r"C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid/media/maps/Muldraugh, KY"

def parse(path):
    b = open(path, "rb").read()
    if b[0:4] != b"LOTH":
        return None
    o = 4
    ver = struct.unpack_from("<I", b, o)[0]; o += 4
    tc = struct.unpack_from("<I", b, o)[0]; o += 4
    for _ in range(tc):
        o = b.index(0x0a, o) + 1
    def i32(off): return struct.unpack_from("<i", b, off)[0]
    w = i32(o); h = i32(o+4); u0 = i32(o+8); u1 = i32(o+12); nrooms = i32(o+16); o += 20
    rooms = []
    trailing_nonzero = 0
    for _ in range(nrooms):
        e = b.index(0x0a, o); name = b[o:e].decode("latin-1"); o = e + 1
        floor = i32(o); nrects = i32(o+4); o += 8
        rects = []
        for _ in range(nrects):
            rects.append((i32(o), i32(o+4), i32(o+8), i32(o+12))); o += 16
        nobjects = i32(o); o += 4          # room objects: (type,x,y) 12 bytes each
        if nobjects != 0: trailing_nonzero += 1
        o += nobjects * 12
        rooms.append((name, floor, rects))
    return dict(ver=ver, w=w, h=h, u0=u0, u1=u1, nrooms=nrooms, rooms=rooms,
                trailing_nonzero=trailing_nonzero, end=o, size=len(b))

def main():
    files = glob.glob(os.path.join(MAP, "*.lotheader"))
    counts = collections.Counter()
    cells_with_rooms = 0
    errors = []
    total_rooms = 0
    versions = collections.Counter()
    trailing_nz = 0
    end_mismatch = 0
    for p in files:
        try:
            r = parse(p)
            if r is None: continue
            versions[r["ver"]] += 1
            trailing_nz += r["trailing_nonzero"]
            if r["nrooms"]: cells_with_rooms += 1
            total_rooms += r["nrooms"]
            for name, floor, rects in r["rooms"]:
                counts[name] += 1
        except Exception as ex:
            errors.append((os.path.basename(p), repr(ex)))
    print(f"files={len(files)} parsed_ok={len(files)-len(errors)} errors={len(errors)}")
    print(f"versions={dict(versions)} cells_with_rooms={cells_with_rooms} total_rooms={total_rooms}")
    print(f"rooms_with_nonzero_trailing={trailing_nz}  distinct_room_names={len(counts)}")
    if errors:
        print("first errors:", errors[:5])
    print("\n=== all RoomDef names by count ===")
    for name, c in counts.most_common():
        print(f"{c:6d}  {name}")

if __name__ == "__main__":
    main()
