/**
 * Type Definition for Xray 
 * See https://confluence.xpand-it.com/display/public/XRAY/REST+API for more information
 */

declare module 'xray-beams' {

    export interface Config {
        baseUrl: string;
        username: string;
        password: string;
        projectKey: string;
    }

    /**
     * Represents the Xray folder
     * https://confluence.xpand-it.com/display/public/XRAY/Test+Repository+-+REST
     */
    export interface Folder {
        /**
         * rank of the folder in the parent folder ("1" corresponds to the first element)
         */
        rank: number,

        /**
         * folder's name
         */
        name: string,

        /**
         * internal folder Id; "-1" corresponds to the Test Repository root folder
         */
        id: number,

        /**
         * count of direct child Tests
         */
        testCount: number,

        /**
         * total count of all childs Tests
         */
        totalTestCount: number,

        /**
         * the full Test Repository path of this folder
         */
        testRepositoryPath: string,

        /**
         * sub-folders
         */
        folders: Folder[]
    }

    /**
     * https://confluence.xpand-it.com/display/public/XRAY/Test+Repository+-+REST
     * To obtain or update information about a given Test Repository folder, you need to specify both the project key and the internal folder Id
     * To remove a folder from the Test Repository,  you need to specify both the project key and the internal folder Id
     */
    export interface XrayTestRepository {
        
        /**
         * Returns a JSON object with a list of the folders of the Test Repository.
		 * @returns A thenable that resolves with the array of folders.
         */
        getFolders(): Thenable<Folder[]>;
        
        /**
         * Creates a folder and returns a JSON object with folder information.
         * @param folderId internal folder Id; "-1" corresponds to the root folder of the Test Repository
         * @param name name of the folder
		 * @returns A thenable that resolves with the created folder.
         */
        createFolder(folderId: number, name: string): Thenable<Folder>;
        
        /**
         * Updates an existing folder.
         * @param folderId internal folder id
         * @param name name of folder
         * @param rank rank within the parent folder
		 * @returns A thenable indicating that the folder has been updated.
         */
        updateFolder(folderId: number, name: string, rank: number): Thenable<void>;

        /**
         * Remove folder from the Test Repository.
         * @param folderId internal folder Id
		 * @returns A thenable indicating that the folder has been deleted.
         */
        deleteFolder(folderId: number): Thenable<void>;
    }
}