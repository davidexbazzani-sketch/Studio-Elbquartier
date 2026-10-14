#!/bin/zsh
# Gesamter Ablauf: Szene bauen → Licht backen → Web-Dateien erzeugen.
# Aufruf: tools/wohnung/pipeline.sh <arbeitsordner> <auflösungsfaktor> <samples> [schritte]
set -e
cd "$(dirname "$0")"
BL=${BLENDER:-/private/tmp/claude-501/-Users-test1-Documents-Projekte-Studio-Elbquatier/002a9f98-fea7-4747-99d0-01cbc313f615/scratchpad/blender/Blender.app/Contents/MacOS/Blender}
OUT=$1; RES=$2; SPP=$3; STEPS=${4:-uv,lm,vx,env,mask,glb}
ZIEL=../../assets/wohnung
mkdir -p $OUT $ZIEL
$BL -b --factory-startup -P build.py -- $OUT/wohnung.blend 2>&1 | grep -E "GESP|rror|Traceback" || true
$BL -b $OUT/wohnung.blend -P bake.py -- $OUT $RES $SPP $STEPS 2>&1 | grep -E "BAKE|rror|Traceback|line [0-9]" || true
$BL -b --factory-startup -P lm_encode.py -- $OUT $ZIEL ${DENOISE:-1} 2>&1 | grep -E "^LM|rror|Traceback" || true
cp $OUT/env_*.hdr $OUT/begehbar.png $ZIEL/
cp $OUT/../sonne.json $OUT/ 2>/dev/null || true
$BL -b --factory-startup -P web_prep.py -- $OUT $ZIEL 2>&1 | grep -E "HIMMEL|META|rror|Traceback" || true
npx --yes @gltf-transform/cli optimize $OUT/wohnung.glb $ZIEL/wohnung.glb --compress meshopt --texture-compress webp \
  --join false --flatten false --instance false --palette false --simplify false --weld false --prune-attributes false 2>&1 | tail -3
# kleine Fassung fürs Handy: Texturen höchstens 512 px
npx --yes @gltf-transform/cli optimize $OUT/wohnung.glb $ZIEL/wohnung_klein.glb --compress meshopt --texture-compress webp --texture-size 512 \
  --join false --flatten false --instance false --palette false --simplify false --weld false --prune-attributes false 2>&1 | tail -1
ls -la $ZIEL
