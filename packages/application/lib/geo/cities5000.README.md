# cities5000.json — GeoNames offline dataset (PLACEHOLDER)

This file is a placeholder. The actual GeoNames cities5000 dataset (CC-BY 4.0, ~5MB)
must be downloaded and committed before Phase 2 ingestion ships.

## How to populate

1. Download: https://download.geonames.org/export/dump/cities5000.zip
2. Unzip to get `cities5000.txt` (tab-delimited, one city per line).
3. Normalize to a JSON array using the GeoNames column order (see below) and
   save the result here as `cities5000.json`.

## Target schema

Each element in the array must conform to the `City` interface exported from
`@monorepo-template/core/db/geo`:

```ts
interface City {
  name: string           // UTF-8 name (column 1)
  asciiName: string      // ASCII transliteration (column 2)
  country: string        // Display country name (derived from countryCode)
  countryCode: string    // ISO 3166-1 alpha-2 (column 8)
  lat: number            // Latitude (column 4)
  lng: number            // Longitude (column 5)
  population: number     // Population (column 14)
  alternateNames: string[] // Comma-separated alternate names (column 3, split)
}
```

## License

GeoNames data is licensed under CC-BY 4.0.
Attribution: GeoNames (https://www.geonames.org)
Include this attribution in `LICENSES.md` at the repo root before shipping.
