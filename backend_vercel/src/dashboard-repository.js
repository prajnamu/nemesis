const { DEFAULT_REGION_PAGE_SIZE, MAX_REGION_PAGE_SIZE } = require("./config");

const LEGEND_COLORS = ["#7b86a3", "#b5a882", "#d4a999", "#8b7332", "#a83c2e"];
const VALID_OWNER_TYPES = ["kabkota", "provinsi", "central", "other"];
const VALID_SEVERITIES = ["low", "med", "high", "absurd"];

function clampInteger(value, defaultValue, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "ya"].includes(String(value).trim().toLowerCase());
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function row(result) {
  return result.rows[0] || null;
}

function rows(result) {
  return result.rows;
}

async function getJsonAsset(db, key, fallback) {
  const result = await db.execute({ sql: "SELECT json FROM assets WHERE key = ?", args: [key] });
  const r = row(result);
  return r ? JSON.parse(r.json) : fallback;
}

function buildLegend(values) {
  const positiveValues = values.filter((v) => v > 0).sort((a, b) => a - b);
  const ranges = [];
  if (!positiveValues.length) return { zeroColor: "#243155", ranges };
  const quantiles = [0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
    const index = Math.min(positiveValues.length - 1, Math.floor((positiveValues.length - 1) * ratio));
    return positiveValues[index];
  });
  let minimum = positiveValues[0];
  for (let i = 0; i < quantiles.length; i++) {
    const maximum = quantiles[i];
    if (maximum < minimum) continue;
    if (ranges.length && maximum === ranges[ranges.length - 1].max) continue;
    ranges.push({ key: `band-${i + 1}`, color: LEGEND_COLORS[Math.min(i, LEGEND_COLORS.length - 1)], min: minimum, max: maximum });
    minimum = maximum + 0.01;
  }
  return { zeroColor: "#243155", ranges };
}

function mapPackageRow(row) {
  return {
    id: row.id,
    sourceId: row.source_id,
    packageName: row.package_name,
    ownerName: row.owner_name,
    ownerType: row.owner_type,
    satker: row.satker,
    locationRaw: row.location_raw,
    budget: row.budget,
    fundingSource: row.funding_source,
    procurementType: row.procurement_type,
    procurementMethod: row.procurement_method,
    selectionDate: row.selection_date,
    audit: {
      schemaVersion: row.schema_version,
      severity: row.severity,
      potensiPemborosan: row.potential_waste,
      reason: row.reason,
      flags: {
        isMencurigakan: row.is_mencurigakan === null ? null : Boolean(row.is_mencurigakan),
        isPemborosan: row.is_pemborosan === null ? null : Boolean(row.is_pemborosan),
      },
    },
    meta: {
      isPriority: Boolean(row.is_priority),
      isFlagged: Boolean(row.is_flagged),
      riskScore: row.risk_score,
      activeTagCount: row.active_tag_count,
      mappedRegionCount: row.mapped_region_count,
    },
  };
}

function mapRegionRow(row) {
  return {
    regionKey: row.region_key,
    code: row.code,
    provinceName: row.province_name,
    regionName: row.region_name,
    regionType: row.region_type,
    displayName: row.display_name,
    totalPackages: row.total_packages,
    totalPriorityPackages: row.total_priority_packages,
    totalFlaggedPackages: row.total_flagged_packages,
    totalPotentialWaste: row.total_potential_waste,
    totalBudget: row.total_budget,
    avgRiskScore: Number((row.avg_risk_score || 0).toFixed(2)),
    maxRiskScore: row.max_risk_score,
    ownerMix: {
      central: row.central_packages,
      provinsi: row.provincial_packages,
      kabkota: row.local_packages,
      other: row.other_packages,
    },
    ownerMetrics: {
      central: { totalPackages: row.central_packages || 0, totalPriorityPackages: row.central_priority_packages || 0, totalPotentialWaste: row.central_potential_waste || 0, totalBudget: row.central_budget || 0 },
      provinsi: { totalPackages: row.provincial_packages || 0, totalPriorityPackages: row.provincial_priority_packages || 0, totalPotentialWaste: row.provincial_potential_waste || 0, totalBudget: row.provincial_budget || 0 },
      kabkota: { totalPackages: row.local_packages || 0, totalPriorityPackages: row.local_priority_packages || 0, totalPotentialWaste: row.local_potential_waste || 0, totalBudget: row.local_budget || 0 },
      other: { totalPackages: row.other_packages || 0, totalPriorityPackages: row.other_priority_packages || 0, totalPotentialWaste: row.other_potential_waste || 0, totalBudget: row.other_budget || 0 },
    },
    severityCounts: { med: row.med_severity_packages, high: row.high_severity_packages, absurd: row.absurd_severity_packages },
    dominantOwnerType: null,
  };
}

function mapProvinceRow(row) {
  return {
    provinceKey: row.province_key,
    code: row.code,
    provinceName: row.province_name,
    regionName: row.province_name,
    regionType: "Provinsi",
    displayName: row.display_name,
    totalPackages: row.total_packages,
    totalPriorityPackages: row.total_priority_packages,
    totalFlaggedPackages: row.total_flagged_packages,
    totalPotentialWaste: row.total_potential_waste,
    totalBudget: row.total_budget,
    avgRiskScore: Number((row.avg_risk_score || 0).toFixed(2)),
    maxRiskScore: row.max_risk_score,
    ownerMix: { central: 0, provinsi: row.total_packages, kabkota: 0, other: 0 },
    ownerMetrics: {
      central: { totalPackages: 0, totalPriorityPackages: 0, totalPotentialWaste: 0, totalBudget: 0 },
      provinsi: { totalPackages: row.total_packages || 0, totalPriorityPackages: row.total_priority_packages || 0, totalPotentialWaste: row.total_potential_waste || 0, totalBudget: row.total_budget || 0 },
      kabkota: { totalPackages: 0, totalPriorityPackages: 0, totalPotentialWaste: 0, totalBudget: 0 },
      other: { totalPackages: 0, totalPriorityPackages: 0, totalPotentialWaste: 0, totalBudget: 0 },
    },
    severityCounts: { med: row.med_severity_packages, high: row.high_severity_packages, absurd: row.absurd_severity_packages },
    dominantOwnerType: row.total_packages > 0 ? "provinsi" : null,
  };
}

function mapOwnerRow(row) {
  return {
    ownerType: row.owner_type,
    ownerName: row.owner_name,
    totalPackages: row.total_packages,
    totalPriorityPackages: row.total_priority_packages,
    totalFlaggedPackages: row.total_flagged_packages,
    totalPotentialWaste: row.total_potential_waste,
    totalBudget: row.total_budget,
    severityCounts: { med: row.med_severity_packages, high: row.high_severity_packages, absurd: row.absurd_severity_packages },
  };
}

function normalizeScopedPackageQuery(requestQuery, options = {}) {
  return {
    page: clampInteger(requestQuery.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInteger(requestQuery.pageSize, DEFAULT_REGION_PAGE_SIZE, 1, MAX_REGION_PAGE_SIZE),
    search: (requestQuery.search || "").trim(),
    ownerType: options.allowOwnerType === false ? "" : (requestQuery.ownerType || "").trim(),
    severity: options.allowSeverity === false ? "" : (requestQuery.severity || "").trim(),
    priorityOnly: parseBooleanQuery(requestQuery.priorityOnly),
  };
}

async function getBootstrapPayload(db) {
  const [summaryResult, regionResult, provinceResult, ownerResult] = await Promise.all([
    db.execute("SELECT COUNT(*) AS total_packages, COALESCE(SUM(is_priority),0) AS total_priority_packages, COALESCE(ROUND(SUM(potential_waste),2),0) AS total_potential_waste, COALESCE(SUM(COALESCE(budget,0)),0) AS total_budget, COALESCE(SUM(CASE WHEN mapped_region_count=0 THEN 1 ELSE 0 END),0) AS unmapped_packages, COALESCE(SUM(CASE WHEN mapped_region_count>1 THEN 1 ELSE 0 END),0) AS multi_location_packages FROM packages"),
    db.execute("SELECT regions.region_key, regions.code, regions.province_name, regions.region_name, regions.region_type, regions.display_name, region_metrics.total_packages, region_metrics.total_priority_packages, region_metrics.total_flagged_packages, region_metrics.total_potential_waste, region_metrics.total_budget, region_metrics.avg_risk_score, region_metrics.max_risk_score, region_metrics.central_packages, region_metrics.provincial_packages, region_metrics.local_packages, region_metrics.other_packages, region_metrics.central_priority_packages, region_metrics.provincial_priority_packages, region_metrics.local_priority_packages, region_metrics.other_priority_packages, region_metrics.central_potential_waste, region_metrics.provincial_potential_waste, region_metrics.local_potential_waste, region_metrics.other_potential_waste, region_metrics.central_budget, region_metrics.provincial_budget, region_metrics.local_budget, region_metrics.other_budget, region_metrics.med_severity_packages, region_metrics.high_severity_packages, region_metrics.absurd_severity_packages FROM regions INNER JOIN region_metrics ON region_metrics.region_key = regions.region_key ORDER BY region_metrics.total_potential_waste DESC, region_metrics.total_packages DESC, regions.display_name ASC"),
    db.execute("SELECT provinces.province_key, provinces.code, provinces.province_name, provinces.display_name, province_metrics.total_packages, province_metrics.total_priority_packages, province_metrics.total_flagged_packages, province_metrics.total_potential_waste, province_metrics.total_budget, province_metrics.avg_risk_score, province_metrics.max_risk_score, province_metrics.med_severity_packages, province_metrics.high_severity_packages, province_metrics.absurd_severity_packages FROM provinces INNER JOIN province_metrics ON province_metrics.province_key = provinces.province_key ORDER BY province_metrics.total_potential_waste DESC, province_metrics.total_packages DESC, provinces.display_name ASC"),
    db.execute({ sql: "SELECT owner_type, owner_name, total_packages, total_priority_packages, total_flagged_packages, total_potential_waste, total_budget, med_severity_packages, high_severity_packages, absurd_severity_packages FROM owner_metrics WHERE owner_type = ? ORDER BY total_potential_waste DESC, total_packages DESC, owner_name ASC", args: ["central"] }),
  ]);

  const summaryRow = row(summaryResult);
  const regionRows = rows(regionResult).map(mapRegionRow);
  const provinceRows = rows(provinceResult).map(mapProvinceRow);
  const ownerRows = rows(ownerResult).map(mapOwnerRow);

  const [geoAsset, provinceGeoAsset] = await Promise.all([
    getJsonAsset(db, "audit_geojson", { type: "FeatureCollection", features: [] }),
    getJsonAsset(db, "audit_province_geojson", { type: "FeatureCollection", features: [] }),
  ]);

  return {
    summary: {
      totalPackages: summaryRow.total_packages || 0,
      totalPriorityPackages: summaryRow.total_priority_packages || 0,
      totalPotentialWaste: summaryRow.total_potential_waste || 0,
      totalBudget: summaryRow.total_budget || 0,
      unmappedPackages: summaryRow.unmapped_packages || 0,
      multiLocationPackages: summaryRow.multi_location_packages || 0,
    },
    legend: buildLegend(regionRows.map((r) => r.totalPotentialWaste)),
    geo: geoAsset,
    regions: regionRows,
    provinceView: {
      legend: buildLegend(provinceRows.map((r) => r.totalPotentialWaste)),
      geo: provinceGeoAsset,
      provinces: provinceRows,
    },
    ownerLists: { central: ownerRows },
  };
}

async function getRegionPackages(db, regionKey, requestQuery) {
  const regionResult = await db.execute({ sql: "SELECT regions.region_key, regions.code, regions.province_name, regions.region_name, regions.region_type, regions.display_name, region_metrics.total_packages, region_metrics.total_priority_packages, region_metrics.total_flagged_packages, region_metrics.total_potential_waste, region_metrics.total_budget, region_metrics.avg_risk_score, region_metrics.max_risk_score, region_metrics.central_packages, region_metrics.provincial_packages, region_metrics.local_packages, region_metrics.other_packages, region_metrics.central_priority_packages, region_metrics.provincial_priority_packages, region_metrics.local_priority_packages, region_metrics.other_priority_packages, region_metrics.central_potential_waste, region_metrics.provincial_potential_waste, region_metrics.local_potential_waste, region_metrics.other_potential_waste, region_metrics.central_budget, region_metrics.provincial_budget, region_metrics.local_budget, region_metrics.other_budget, region_metrics.med_severity_packages, region_metrics.high_severity_packages, region_metrics.absurd_severity_packages FROM regions INNER JOIN region_metrics ON region_metrics.region_key = regions.region_key WHERE regions.region_key = ?", args: [regionKey] });
  const regionRow = row(regionResult);
  if (!regionRow) return null;

  const q = normalizeScopedPackageQuery(requestQuery);
  const clauses = ["package_regions.region_key = ?"];
  const args = [regionKey];

  if (q.search) { const s = `%${escapeLikePattern(q.search)}%`; clauses.push("(packages.package_name LIKE ? ESCAPE '\\' OR packages.owner_name LIKE ? ESCAPE '\\' OR COALESCE(packages.satker,'') LIKE ? ESCAPE '\\')"); args.push(s, s, s); }
  if (VALID_OWNER_TYPES.includes(q.ownerType)) { clauses.push("packages.owner_type = ?"); args.push(q.ownerType); }
  if (VALID_SEVERITIES.includes(q.severity)) { clauses.push("packages.severity = ?"); args.push(q.severity); }
  if (q.priorityOnly) clauses.push("packages.is_priority = 1");

  const where = clauses.join(" AND ");
  const countResult = await db.execute({ sql: `SELECT COUNT(*) AS total FROM package_regions INNER JOIN packages ON packages.id = package_regions.package_id WHERE ${where}`, args });
  const totalItems = row(countResult).total || 0;
  const totalPages = totalItems ? Math.ceil(totalItems / q.pageSize) : 1;
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  const pkgResult = await db.execute({ sql: `SELECT packages.id, packages.source_id, packages.schema_version, packages.owner_name, packages.owner_type, packages.satker, packages.package_name, packages.location_raw, packages.budget, packages.funding_source, packages.procurement_type, packages.procurement_method, packages.selection_date, packages.potential_waste, packages.severity, packages.reason, packages.is_mencurigakan, packages.is_pemborosan, packages.risk_score, packages.active_tag_count, packages.is_priority, packages.is_flagged, packages.mapped_region_count FROM package_regions INNER JOIN packages ON packages.id = package_regions.package_id WHERE ${where} ORDER BY packages.is_priority DESC, packages.potential_waste DESC, packages.risk_score DESC, COALESCE(packages.budget,0) DESC, packages.inserted_order ASC LIMIT ? OFFSET ?`, args: [...args, q.pageSize, offset] });

  return {
    region: mapRegionRow(regionRow),
    summary: { totalItems, filteredItems: totalItems },
    pagination: { page, pageSize: q.pageSize, totalItems, totalPages },
    filters: { search: q.search, ownerType: q.ownerType, severity: q.severity, priorityOnly: q.priorityOnly },
    items: rows(pkgResult).map(mapPackageRow),
  };
}

async function getProvincePackages(db, provinceKey, requestQuery) {
  const provinceResult = await db.execute({ sql: "SELECT provinces.province_key, provinces.code, provinces.province_name, provinces.display_name, province_metrics.total_packages, province_metrics.total_priority_packages, province_metrics.total_flagged_packages, province_metrics.total_potential_waste, province_metrics.total_budget, province_metrics.avg_risk_score, province_metrics.max_risk_score, province_metrics.med_severity_packages, province_metrics.high_severity_packages, province_metrics.absurd_severity_packages FROM provinces INNER JOIN province_metrics ON province_metrics.province_key = provinces.province_key WHERE provinces.province_key = ?", args: [provinceKey] });
  const provinceRow = row(provinceResult);
  if (!provinceRow) return null;

  const q = normalizeScopedPackageQuery(requestQuery, { allowOwnerType: false });
  const clauses = ["package_provinces.province_key = ?", "packages.owner_type = 'provinsi'"];
  const args = [provinceKey];

  if (q.search) { const s = `%${escapeLikePattern(q.search)}%`; clauses.push("(packages.package_name LIKE ? ESCAPE '\\' OR packages.owner_name LIKE ? ESCAPE '\\' OR COALESCE(packages.satker,'') LIKE ? ESCAPE '\\')"); args.push(s, s, s); }
  if (VALID_SEVERITIES.includes(q.severity)) { clauses.push("packages.severity = ?"); args.push(q.severity); }
  if (q.priorityOnly) clauses.push("packages.is_priority = 1");

  const where = clauses.join(" AND ");
  const countResult = await db.execute({ sql: `SELECT COUNT(*) AS total FROM package_provinces INNER JOIN packages ON packages.id = package_provinces.package_id WHERE ${where}`, args });
  const totalItems = row(countResult).total || 0;
  const totalPages = totalItems ? Math.ceil(totalItems / q.pageSize) : 1;
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  const pkgResult = await db.execute({ sql: `SELECT packages.id, packages.source_id, packages.schema_version, packages.owner_name, packages.owner_type, packages.satker, packages.package_name, packages.location_raw, packages.budget, packages.funding_source, packages.procurement_type, packages.procurement_method, packages.selection_date, packages.potential_waste, packages.severity, packages.reason, packages.is_mencurigakan, packages.is_pemborosan, packages.risk_score, packages.active_tag_count, packages.is_priority, packages.is_flagged, packages.mapped_region_count FROM package_provinces INNER JOIN packages ON packages.id = package_provinces.package_id WHERE ${where} ORDER BY packages.is_priority DESC, packages.potential_waste DESC, packages.risk_score DESC, COALESCE(packages.budget,0) DESC, packages.inserted_order ASC LIMIT ? OFFSET ?`, args: [...args, q.pageSize, offset] });

  return {
    province: mapProvinceRow(provinceRow),
    summary: { totalItems, filteredItems: totalItems },
    pagination: { page, pageSize: q.pageSize, totalItems, totalPages },
    filters: { search: q.search, severity: q.severity, priorityOnly: q.priorityOnly },
    items: rows(pkgResult).map(mapPackageRow),
  };
}

async function getOwnerPackages(db, requestQuery) {
  const ownerType = (requestQuery.ownerType || "").trim();
  const ownerName = (requestQuery.ownerName || "").trim();
  if (!VALID_OWNER_TYPES.includes(ownerType) || !ownerName) return null;

  const ownerResult = await db.execute({ sql: "SELECT owner_type, owner_name, total_packages, total_priority_packages, total_flagged_packages, total_potential_waste, total_budget, med_severity_packages, high_severity_packages, absurd_severity_packages FROM owner_metrics WHERE owner_type = ? AND owner_name = ?", args: [ownerType, ownerName] });
  const ownerRow = row(ownerResult);
  if (!ownerRow) return null;

  const q = normalizeScopedPackageQuery(requestQuery, { allowOwnerType: false });
  const clauses = ["packages.owner_type = ?", "packages.owner_name = ?"];
  const args = [ownerType, ownerName];

  if (q.search) { const s = `%${escapeLikePattern(q.search)}%`; clauses.push("(packages.package_name LIKE ? ESCAPE '\\' OR packages.owner_name LIKE ? ESCAPE '\\' OR COALESCE(packages.satker,'') LIKE ? ESCAPE '\\')"); args.push(s, s, s); }
  if (VALID_SEVERITIES.includes(q.severity)) { clauses.push("packages.severity = ?"); args.push(q.severity); }
  if (q.priorityOnly) clauses.push("packages.is_priority = 1");

  const where = clauses.join(" AND ");
  const countResult = await db.execute({ sql: `SELECT COUNT(*) AS total FROM packages WHERE ${where}`, args });
  const totalItems = row(countResult).total || 0;
  const totalPages = totalItems ? Math.ceil(totalItems / q.pageSize) : 1;
  const page = Math.min(q.page, totalPages);
  const offset = (page - 1) * q.pageSize;

  const pkgResult = await db.execute({ sql: `SELECT packages.id, packages.source_id, packages.schema_version, packages.owner_name, packages.owner_type, packages.satker, packages.package_name, packages.location_raw, packages.budget, packages.funding_source, packages.procurement_type, packages.procurement_method, packages.selection_date, packages.potential_waste, packages.severity, packages.reason, packages.is_mencurigakan, packages.is_pemborosan, packages.risk_score, packages.active_tag_count, packages.is_priority, packages.is_flagged, packages.mapped_region_count FROM packages WHERE ${where} ORDER BY packages.is_priority DESC, packages.potential_waste DESC, packages.risk_score DESC, COALESCE(packages.budget,0) DESC, packages.inserted_order ASC LIMIT ? OFFSET ?`, args: [...args, q.pageSize, offset] });

  return {
    owner: mapOwnerRow(ownerRow),
    summary: { totalItems, filteredItems: totalItems },
    pagination: { page, pageSize: q.pageSize, totalItems, totalPages },
    filters: { search: q.search, severity: q.severity, priorityOnly: q.priorityOnly },
    items: rows(pkgResult).map(mapPackageRow),
  };
}

module.exports = { getBootstrapPayload, getOwnerPackages, getRegionPackages, getProvincePackages };