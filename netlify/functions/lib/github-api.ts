/**
 * Утилиты для работы с GitHub API
 * Используется для обновления JSON файлов в репозитории
 */

interface GitHubFileUpdate {
  message: string;
  content: string; // base64 encoded
  sha?: string; // SHA хеш файла для обновления существующего файла
  branch?: string;
}

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

/**
 * Получает SHA хеш файла из GitHub репозитория
 */
export async function getFileSha(
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main',
  token?: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...(token && { Authorization: `token ${token}` }),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Файл не найден
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubFileResponse;
    return data.sha;
  } catch (error) {
    console.error('❌ Error getting file SHA from GitHub:', error);
    throw error;
  }
}

/**
 * Обновляет файл в GitHub репозитории
 */
export async function updateGitHubFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string = 'main',
  token?: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
  if (!token) {
    console.warn('⚠️ GitHub token not provided, skipping JSON update');
    return { success: false, error: 'GitHub token not provided' };
  }

  try {
    // Получаем SHA существующего файла (если есть)
    let sha: string | null = null;
    try {
      sha = await getFileSha(owner, repo, path, branch, token);
    } catch (error) {
      console.warn('⚠️ Could not get file SHA, will create new file:', error);
    }

    // Кодируем контент в base64
    const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

    const updateData: GitHubFileUpdate = {
      message,
      content: encodedContent,
      branch,
    };

    if (sha) {
      updateData.sha = sha;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = (await response.json()) as { commit: { sha: string } };
    console.log('✅ Successfully updated file in GitHub:', path);

    return { success: true, sha: result.commit.sha };
  } catch (error) {
    console.error('❌ Error updating file in GitHub:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Обновляет JSON файл альбома в GitHub репозитории
 */
export async function updateAlbumsJson(
  lang: 'en' | 'ru',
  albums: unknown[],
  albumId: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  const owner = process.env.GITHUB_OWNER || 'zhoock';
  const repo = process.env.GITHUB_REPO || 'smolyanoe-chuchelko';
  const path = `src/assets/albums-${lang}.json`;
  const branch = process.env.GITHUB_BRANCH || 'main';

  const content = JSON.stringify(albums, null, 2);
  const message = `Update album ${albumId} (${lang})`;

  const result = await updateGitHubFile(owner, repo, path, content, message, branch, token);

  if (!result.success) {
    console.warn('⚠️ Failed to update JSON file in GitHub:', result.error);
  }

  return result;
}
