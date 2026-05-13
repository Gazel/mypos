import { pool } from "../db/pool.js";
import { nextDateParam } from "../utils/date.js";

const WARNING_MESSAGES = {
  MISSING_RECIPE: "Produk terjual belum memiliki resep, HPP dihitung 0.",
  MISSING_PRICE:
    "Bahan belum memiliki harga efektif pada tanggal transaksi, HPP bahan dihitung 0.",
  INACTIVE_INGREDIENT:
    "Resep menggunakan bahan nonaktif. Usage tetap dihitung untuk akurasi historis.",
};

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function toNumber(value) {
  return Number(value ?? 0);
}

function normalizeDisplayUnit(unit) {
  return String(unit || "").trim().toLowerCase();
}

function getDisplayFactor(baseUnit, displayUnit) {
  const normalizedDisplayUnit = normalizeDisplayUnit(displayUnit || baseUnit);

  if (baseUnit === "gram") {
    if (["kg", "kilogram"].includes(normalizedDisplayUnit)) return 1000;
    return 1;
  }

  if (baseUnit === "ml") {
    if (["l", "liter", "litre"].includes(normalizedDisplayUnit)) return 1000;
    return 1;
  }

  return 1;
}

function toDisplayQuantity(baseQty, baseUnit, displayUnit) {
  return baseQty / getDisplayFactor(baseUnit, displayUnit);
}

function getPricePerBaseUnit(price) {
  return (
    toNumber(price.pricePerDisplayUnit) /
    getDisplayFactor(price.baseUnit, price.displayUnit)
  );
}

function addWarning(warningMap, warning) {
  const key = [
    warning.type,
    warning.productId || "",
    warning.productName || "",
    warning.ingredientId || "",
  ].join("|");

  if (warningMap.has(key)) return;

  warningMap.set(key, {
    message: WARNING_MESSAGES[warning.type],
    ...warning,
  });
}

async function fetchSalesRows(startDate, endDate) {
  const params = [`${startDate} 00:00:00`, `${nextDateParam(endDate)} 00:00:00`];

  const [[summaryRow]] = await pool.query(
    `
    SELECT
      COUNT(*) AS transaction_count,
      COALESCE(SUM(t.total), 0) AS total_sales
    FROM transactions t
    WHERE COALESCE(t.status, 'SUCCESS') = 'SUCCESS'
      AND t.payment_method <> 'cancelled'
      AND t.date >= ?
      AND t.date < ?
    `,
    params
  );

  const [salesRows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(t.date, '%Y-%m-%d') AS transaction_date,
      ti.product_id,
      COALESCE(p.name, ti.name, 'Produk tanpa nama') AS product_name,
      COALESCE(SUM(ti.quantity), 0) AS sold_qty,
      COALESCE(SUM(ti.subtotal), 0) AS total_sales
    FROM transactions t
    JOIN transaction_items ti ON ti.transaction_id = t.id
    LEFT JOIN products p ON p.id = ti.product_id
    WHERE COALESCE(t.status, 'SUCCESS') = 'SUCCESS'
      AND t.payment_method <> 'cancelled'
      AND t.date >= ?
      AND t.date < ?
    GROUP BY
      DATE_FORMAT(t.date, '%Y-%m-%d'),
      ti.product_id,
      COALESCE(p.name, ti.name, 'Produk tanpa nama')
    ORDER BY transaction_date ASC, product_name ASC
    `,
    params
  );

  return {
    summary: {
      transactionCount: Number(summaryRow?.transaction_count ?? 0),
      totalSales: Number(summaryRow?.total_sales ?? 0),
    },
    salesRows,
  };
}

async function fetchRecipes(productIds) {
  if (productIds.length === 0) return new Map();

  const placeholders = productIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `
    SELECT
      pr.product_id,
      pr.ingredient_id,
      pr.quantity_per_product,
      pr.unit,
      i.name AS ingredient_name,
      i.base_unit,
      i.display_unit,
      i.is_active
    FROM product_recipes pr
    JOIN ingredients i ON i.id = pr.ingredient_id
    WHERE pr.product_id IN (${placeholders})
    ORDER BY pr.product_id ASC, i.name ASC
    `,
    productIds
  );

  const recipes = new Map();

  for (const row of rows) {
    const productId = String(row.product_id);
    const item = {
      productId,
      ingredientId: String(row.ingredient_id),
      ingredientName: row.ingredient_name,
      quantityPerProduct: Number(row.quantity_per_product ?? 0),
      unit: row.unit,
      baseUnit: row.base_unit,
      displayUnit: row.display_unit,
      isActive: Boolean(row.is_active),
    };

    if (!recipes.has(productId)) recipes.set(productId, []);
    recipes.get(productId).push(item);
  }

  return recipes;
}

async function fetchPrices(ingredientIds, endDate) {
  if (ingredientIds.length === 0) return new Map();

  const placeholders = ingredientIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `
    SELECT
      ip.ingredient_id,
      DATE_FORMAT(ip.effective_date, '%Y-%m-%d') AS effective_date,
      ip.price_per_display_unit,
      ip.display_unit,
      i.base_unit
    FROM ingredient_prices ip
    JOIN ingredients i ON i.id = ip.ingredient_id
    WHERE ip.ingredient_id IN (${placeholders})
      AND ip.effective_date <= ?
    ORDER BY ip.ingredient_id ASC, ip.effective_date ASC, ip.id ASC
    `,
    [...ingredientIds, endDate]
  );

  const prices = new Map();

  for (const row of rows) {
    const ingredientId = String(row.ingredient_id);
    const price = {
      ingredientId,
      effectiveDate: row.effective_date,
      pricePerDisplayUnit: Number(row.price_per_display_unit ?? 0),
      displayUnit: row.display_unit,
      baseUnit: row.base_unit,
    };

    if (!prices.has(ingredientId)) prices.set(ingredientId, []);
    prices.get(ingredientId).push(price);
  }

  return prices;
}

function findEffectivePrice(priceRows = [], transactionDate) {
  let effectivePrice = null;

  for (const price of priceRows) {
    if (price.effectiveDate <= transactionDate) {
      effectivePrice = price;
      continue;
    }

    break;
  }

  return effectivePrice;
}

function getOrCreateProductUsage(productUsageMap, row) {
  const productId = row.product_id ? String(row.product_id) : "";
  const productName = String(row.product_name || "Produk tanpa nama");
  const productKey = productId || `name:${productName}`;

  if (!productUsageMap.has(productKey)) {
    productUsageMap.set(productKey, {
      productId,
      productName,
      soldQty: 0,
      totalSales: 0,
      estimatedHppPerProduct: 0,
      totalEstimatedHpp: 0,
      estimatedGrossProfit: 0,
      estimatedMargin: 0,
      ingredients: [],
    });
  }

  return {
    productKey,
    productUsage: productUsageMap.get(productKey),
  };
}

function getOrCreateIngredientUsage(ingredientUsageMap, recipe) {
  if (!ingredientUsageMap.has(recipe.ingredientId)) {
    ingredientUsageMap.set(recipe.ingredientId, {
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredientName,
      baseUnit: recipe.baseUnit,
      displayUnit: recipe.displayUnit,
      usedBaseQty: 0,
      usedDisplayQty: 0,
      pricePerDisplayUnit: 0,
      estimatedHpp: 0,
    });
  }

  return ingredientUsageMap.get(recipe.ingredientId);
}

function getOrCreateProductIngredientUsage(productIngredientUsageMaps, productKey, recipe) {
  if (!productIngredientUsageMaps.has(productKey)) {
    productIngredientUsageMaps.set(productKey, new Map());
  }

  const usageMap = productIngredientUsageMaps.get(productKey);

  if (!usageMap.has(recipe.ingredientId)) {
    usageMap.set(recipe.ingredientId, {
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredientName,
      baseUnit: recipe.baseUnit,
      displayUnit: recipe.displayUnit,
      usedBaseQty: 0,
      usedDisplayQty: 0,
      pricePerDisplayUnit: 0,
      estimatedHpp: 0,
    });
  }

  return usageMap.get(recipe.ingredientId);
}

function finalizeIngredientUsage(row) {
  return {
    ...row,
    usedBaseQty: round(row.usedBaseQty, 4),
    usedDisplayQty: round(row.usedDisplayQty, 4),
    pricePerDisplayUnit:
      row.usedDisplayQty > 0 ? round(row.estimatedHpp / row.usedDisplayQty) : 0,
    estimatedHpp: round(row.estimatedHpp),
  };
}

function finalizeProductUsage(row, productIngredientUsageMaps, productKey) {
  const soldQty = Number(row.soldQty || 0);
  const ingredients = [
    ...(productIngredientUsageMaps.get(productKey)?.values() || []),
  ].map(finalizeIngredientUsage);
  const totalEstimatedHpp = ingredients.reduce(
    (sum, ingredient) => sum + ingredient.estimatedHpp,
    0
  );
  const estimatedGrossProfit = Number(row.totalSales || 0) - totalEstimatedHpp;

  return {
    ...row,
    soldQty: round(soldQty, 4),
    totalSales: round(row.totalSales),
    estimatedHppPerProduct:
      soldQty > 0 ? round(totalEstimatedHpp / soldQty) : 0,
    totalEstimatedHpp: round(totalEstimatedHpp),
    estimatedGrossProfit: round(estimatedGrossProfit),
    estimatedMargin:
      row.totalSales > 0 ? round((estimatedGrossProfit / row.totalSales) * 100) : 0,
    ingredients,
  };
}

export async function fetchRecipeUsageReport({ startDate, endDate }) {
  const { summary, salesRows } = await fetchSalesRows(startDate, endDate);
  const productIds = [
    ...new Set(
      salesRows
        .map((row) => Number(row.product_id))
        .filter((productId) => Number.isInteger(productId) && productId > 0)
    ),
  ];

  const recipes = await fetchRecipes(productIds);
  const ingredientIds = [
    ...new Set(
      [...recipes.values()]
        .flat()
        .map((recipe) => Number(recipe.ingredientId))
        .filter((ingredientId) => Number.isInteger(ingredientId) && ingredientId > 0)
    ),
  ];
  const prices = await fetchPrices(ingredientIds, endDate);

  const warningMap = new Map();
  const productUsageMap = new Map();
  const productIngredientUsageMaps = new Map();
  const ingredientUsageMap = new Map();

  for (const row of salesRows) {
    const transactionDate = row.transaction_date;
    const soldQty = Number(row.sold_qty ?? 0);
    const productId = row.product_id ? String(row.product_id) : "";
    const productName = String(row.product_name || "Produk tanpa nama");
    const { productKey, productUsage } = getOrCreateProductUsage(
      productUsageMap,
      row
    );

    productUsage.soldQty += soldQty;
    productUsage.totalSales += Number(row.total_sales ?? 0);

    const recipeItems = productId ? recipes.get(productId) || [] : [];

    if (recipeItems.length === 0) {
      addWarning(warningMap, {
        type: "MISSING_RECIPE",
        productId,
        productName,
      });
      continue;
    }

    let productHppForRow = 0;

    for (const recipe of recipeItems) {
      if (!recipe.isActive) {
        addWarning(warningMap, {
          type: "INACTIVE_INGREDIENT",
          productId,
          productName,
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredientName,
        });
      }

      const usedBaseQty = soldQty * recipe.quantityPerProduct;
      const usedDisplayQty = toDisplayQuantity(
        usedBaseQty,
        recipe.baseUnit,
        recipe.displayUnit
      );
      const effectivePrice = findEffectivePrice(
        prices.get(recipe.ingredientId),
        transactionDate
      );
      let estimatedHpp = 0;

      if (effectivePrice) {
        estimatedHpp = usedBaseQty * getPricePerBaseUnit(effectivePrice);
      } else {
        addWarning(warningMap, {
          type: "MISSING_PRICE",
          productId,
          productName,
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredientName,
          date: transactionDate,
        });
      }

      productHppForRow += estimatedHpp;

      const ingredientUsage = getOrCreateIngredientUsage(
        ingredientUsageMap,
        recipe
      );
      ingredientUsage.usedBaseQty += usedBaseQty;
      ingredientUsage.usedDisplayQty += usedDisplayQty;
      ingredientUsage.estimatedHpp += estimatedHpp;

      const productIngredientUsage = getOrCreateProductIngredientUsage(
        productIngredientUsageMaps,
        productKey,
        recipe
      );
      productIngredientUsage.usedBaseQty += usedBaseQty;
      productIngredientUsage.usedDisplayQty += usedDisplayQty;
      productIngredientUsage.estimatedHpp += estimatedHpp;
    }

    productUsage.totalEstimatedHpp += productHppForRow;
  }

  const estimatedHpp = [...ingredientUsageMap.values()].reduce(
    (sum, row) => sum + row.estimatedHpp,
    0
  );
  const estimatedGrossProfit = summary.totalSales - estimatedHpp;
  const estimatedMargin =
    summary.totalSales > 0 ? (estimatedGrossProfit / summary.totalSales) * 100 : 0;

  return {
    filters: {
      startDate,
      endDate,
    },
    summary: {
      transactionCount: summary.transactionCount,
      totalSales: round(summary.totalSales),
      estimatedHpp: round(estimatedHpp),
      estimatedGrossProfit: round(estimatedGrossProfit),
      estimatedMargin: round(estimatedMargin),
    },
    productUsage: [...productUsageMap.entries()].map(([productKey, row]) =>
      finalizeProductUsage(row, productIngredientUsageMaps, productKey)
    ),
    ingredientUsage: [...ingredientUsageMap.values()].map(finalizeIngredientUsage),
    warnings: [...warningMap.values()],
  };
}
