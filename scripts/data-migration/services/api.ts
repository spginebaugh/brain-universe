import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local in project root
// __dirname is the current directory (services), so we need to go up three levels
const envPath = path.resolve(__dirname, '../../../.env.local');
dotenv.config({ path: envPath });

const TEXAS_MATH_API_URL = 'https://api.commonstandardsproject.com/api/v1/standard_sets/28903EF2A9F9469C9BF592D4D0BE10F8_D2486388_grades-10-11-12';

// Verify API key is available
const API_KEY = process.env.COMMON_STANDARDS_API_KEY;
if (!API_KEY) {
  throw new Error('COMMON_STANDARDS_API_KEY is not set in environment variables. Please check that .env.local exists in the project root and contains this key.');
}

interface StandardData {
  id: string;
  asnIdentifier: string;
  statementNotation: string;
  listId?: string;
  description: string;
  position: number;
  depth: number;
  ancestorIds: string[];
}

export interface TexasApiResponse {
  data: {
    title: string;
    subject: string;
    normalizedSubject: string;
    educationLevels: string[];
    jurisdiction: {
      id: string;
      title: string;
    };
    standards: Record<string, StandardData>;
  };
}

export async function fetchTexasMathStandards(): Promise<TexasApiResponse> {
  try {
    const response = await axios.get<TexasApiResponse>(TEXAS_MATH_API_URL, {
      headers: {
        'Accept': 'application/json',
        'Api-Key': API_KEY
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch Texas Math Standards: ${error.message}`);
    }
    throw error;
  }
} 