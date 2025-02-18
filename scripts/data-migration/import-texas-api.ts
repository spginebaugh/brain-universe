import { fetchTexasMathStandards } from './services/api';
import { processTexasApiStandards } from './processors/texas-math-api';
import { validateStandard } from './validation';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseStandard } from './types';

async function importTexasStandards() {
  try {
    console.log('Fetching Texas Math Standards from API...');
    
    // Fetch standards from API
    const apiResponse = await fetchTexasMathStandards();
    
    // Process the API response
    const standards = processTexasApiStandards(apiResponse);
    
    console.log(`Processing ${standards.length} standards...`);

    // Validate and process standards
    const validatedStandards = standards.map((standard: BaseStandard) => {
      try {
        return validateStandard(standard);
      } catch (error) {
        console.error(`Validation error for standard ${standard.id}:`, error);
        return null;
      }
    }).filter((standard: BaseStandard | null): standard is BaseStandard => standard !== null);

    // Adjust depths (subtract 1 from each depth)
    const adjustedStandards: BaseStandard[] = validatedStandards.map((standard: BaseStandard) => ({
      ...standard,
      metadata: {
        ...standard.metadata,
        depth: standard.metadata.depth - 1
      }
    }));

    // Create output directory if it doesn't exist
    const outputDir = path.resolve(__dirname, 'processed_JSON');
    await fs.mkdir(outputDir, { recursive: true });

    // Write to JSON file
    const outputPath = path.join(outputDir, 'texas_math_standards.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify(adjustedStandards, null, 2),
      'utf-8'
    );

    console.log('\nImport Summary:');
    console.log(`Successfully processed: ${adjustedStandards.length} standards`);
    console.log(`Failed to process: ${standards.length - adjustedStandards.length} standards`);
    console.log(`Output written to: ${outputPath}`);

  } catch (error) {
    console.error('Error in import process:', error);
    throw error;
  }
}

// Add command line argument support
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('Running in dry-run mode - no file will be written');
}

// Run the import
importTexasStandards().catch(console.error); 