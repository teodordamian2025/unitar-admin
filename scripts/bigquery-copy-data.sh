#!/bin/bash
# ==================================================================
# SCRIPT COPIERE DATE DIN TABELE VECHI → TABELE NOI V2
# Data: 01.10.2025 (ora României)
# Descriere: Copiază toate datele din tabele originale în tabele optimizate _v2
# Dataset: PanouControlUnitar
# Prerequisite: Rulează DOAR după ce toate tabelele v2 au fost create cu bigquery-create-tables.sql
# ==================================================================

set -e  # Exit on error

DATASET="PanouControlUnitar"

echo "========================================="
echo "BIGQUERY DATA MIGRATION SCRIPT"
echo "Dataset: $DATASET"
echo "Direction: OLD TABLES → NEW TABLES (_v2)"
echo "========================================="
echo ""

# ==================================================================
# CATEGORIA 1: TIME-SERIES TABLES (19 tabele)
# ==================================================================

echo "📊 CATEGORIA 1: TIME-SERIES TABLES (19 tabele)"
echo "----------------------------------------------"

TABLES_TIME_SERIES=(
  "AnafEFactura"
  "AnafErrorLog"
  "AnafNotificationLog"
  "AnexeContract"
  "Contracte"
  "EtapeContract"
  "EtapeFacturi"
  "FacturiGenerate"
  "FacturiPrimite"
  "PlanificatorPersonal"
  "ProcesVerbale"
  "ProiectComentarii"
  "Proiecte"
  "ProiecteCheltuieli"
  "Sarcini"
  "SesiuniLucru"
  "Subproiecte"
  "TimeTracking"
  "TranzactiiBancare"
)

for table in "${TABLES_TIME_SERIES[@]}"; do
  echo ""
  echo "🔄 Copiez date pentru: $table"
  echo "   Source: $DATASET.$table"
  echo "   Target: $DATASET.${table}_v2"

  # Verifică dacă tabelul sursă există și are date
  COUNT=$(bq query --use_legacy_sql=false --format=csv "SELECT COUNT(*) as count FROM \`$DATASET.$table\`" | tail -n 1)

  if [ "$COUNT" -eq "0" ]; then
    echo "   ⚠️  WARNING: Tabelul $table este gol (0 rânduri). Skip copiere."
    continue
  fi

  echo "   📈 Rânduri găsite: $COUNT"

  # Copiere date
  bq query --use_legacy_sql=false \
    "INSERT INTO \`$DATASET.${table}_v2\`
     SELECT * FROM \`$DATASET.$table\`;"

  # Verificare copiere
  COUNT_V2=$(bq query --use_legacy_sql=false --format=csv "SELECT COUNT(*) as count FROM \`$DATASET.${table}_v2\`" | tail -n 1)

  if [ "$COUNT" -eq "$COUNT_V2" ]; then
    echo "   ✅ SUCCESS: $COUNT rânduri copiate cu succes"
  else
    echo "   ❌ ERROR: Discrepanță! Source: $COUNT, Target: $COUNT_V2"
    exit 1
  fi
done

# ==================================================================
# CATEGORIA 2: LOOKUP TABLES (13 tabele)
# ==================================================================

echo ""
echo ""
echo "📚 CATEGORIA 2: LOOKUP TABLES (13 tabele)"
echo "-------------------------------------------"

TABLES_LOOKUP=(
  "AnafTokens"
  "Clienti"
  "CursuriValutare"
  "Produse"
  "ProiecteResponsabili"
  "SarciniResponsabili"
  "Subcontractanti"
  "SubproiecteResponsabili"
  "TranzactiiAccounts"
  "TranzactiiMatching"
  "TranzactiiSyncLogs"
  "Utilizatori"
  "TranzactiiStats"
)

for table in "${TABLES_LOOKUP[@]}"; do
  echo ""
  echo "🔄 Copiez date pentru: $table"
  echo "   Source: $DATASET.$table"
  echo "   Target: $DATASET.${table}_v2"

  # Verifică dacă tabelul sursă există și are date
  COUNT=$(bq query --use_legacy_sql=false --format=csv "SELECT COUNT(*) as count FROM \`$DATASET.$table\`" | tail -n 1)

  if [ "$COUNT" -eq "0" ]; then
    echo "   ⚠️  WARNING: Tabelul $table este gol (0 rânduri). Skip copiere."
    continue
  fi

  echo "   📈 Rânduri găsite: $COUNT"

  # Copiere date
  bq query --use_legacy_sql=false \
    "INSERT INTO \`$DATASET.${table}_v2\`
     SELECT * FROM \`$DATASET.$table\`;"

  # Verificare copiere
  COUNT_V2=$(bq query --use_legacy_sql=false --format=csv "SELECT COUNT(*) as count FROM \`$DATASET.${table}_v2\`" | tail -n 1)

  if [ "$COUNT" -eq "$COUNT_V2" ]; then
    echo "   ✅ SUCCESS: $COUNT rânduri copiate cu succes"
  else
    echo "   ❌ ERROR: Discrepanță! Source: $COUNT, Target: $COUNT_V2"
    exit 1
  fi
done

# ==================================================================
# SUMAR FINAL
# ==================================================================

echo ""
echo ""
echo "========================================="
echo "✅ MIGRARE COMPLETĂ CU SUCCES!"
echo "========================================="
echo ""
echo "📊 SUMAR:"
echo "   - Time-Series Tables: ${#TABLES_TIME_SERIES[@]} tabele"
echo "   - Lookup Tables: ${#TABLES_LOOKUP[@]} tabele"
echo "   - TOTAL: $((${#TABLES_TIME_SERIES[@]} + ${#TABLES_LOOKUP[@]})) tabele migrate"
echo ""
echo "📁 TABELE NOI CREATE:"
for table in "${TABLES_TIME_SERIES[@]}" "${TABLES_LOOKUP[@]}"; do
  COUNT_V2=$(bq query --use_legacy_sql=false --format=csv "SELECT COUNT(*) as count FROM \`$DATASET.${table}_v2\`" 2>/dev/null | tail -n 1 || echo "0")
  printf "   %-30s %10s rânduri\n" "${table}_v2" "$COUNT_V2"
done

echo ""
echo "🎯 NEXT STEPS:"
echo "   1. Verifică manual că datele sunt corecte în BigQuery Console"
echo "   2. Testează API-urile în localhost cu tabele v2"
echo "   3. Dacă totul funcționează: șterge tabele vechi, redenumește v2 → original"
echo ""
echo "========================================="
