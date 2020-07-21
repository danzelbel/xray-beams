/**
 * Type Definition for Xray 
 * See https://confluence.xpand-it.com/display/public/XRAY/REST+API for more information
 */

declare module 'xray-beams' {

    export interface Config {
        baseUrl: string;
        projectKey: string;
        username: string;
        password: string;
        jqlOrphans: string;
    }

    /**
     * Represents the Xray test
     * https://confluence.xpand-it.com/display/public/XRAY/Test+Repository+-+REST
     */
    export interface Test {

        /**
         * internal Test Id
         */
        id: number;

        /**
         * Test's issue key
         */
        key: string;

        /**
         * Test's summary
         */
        summary: string;

        /**
         * Test's issue assignee
         */
        assignee: string;

        /**
         * rank of the Test in the parent folder ("1" corresponds to the first element)
         */
        rank: number;

        /**
         * Test's workflow status
         */
        workflowStatus: string;

        /**
         * array of all Test's assigned labels
         */
        labels: string[];

        /**
         * array of all Test's assigned components
         */
        components: string[];

        /**
         * Test type (e.g. "Manual", "Cucumber, "Generic")
         */
        testType: string;
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
         * Returns a JSON object with a list of the Tests contained in the orphans folder of the Test Repository.
         * @returns A thenable that resolves with the array of tests.
         */
        getOrphans(): Promise<Test[]>;

        /**
         * Returns a JSON object with a list of the Tests contained in a given folder of the Test Repository.
         * @param folderId internal folder id
         * @returns A thenable that resolves with the array of tests.
         */
        getTests(folderId: number): Thenable<Test[]>;

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
         * Moves an existing folder.
         * @param folderId internal folder id
         * @param destinationFolderId internal destination folder id
		 * @returns A thenable indicating that the folder has been updated.
         */
        moveFolder(folderId: number, destinationFolderId: number): Promise<void>;

        /**
         * Remove folder from the Test Repository.
         * @param folderId internal folder Id
		 * @returns A thenable indicating that the folder has been deleted.
         */
        deleteFolder(folderId: number): Thenable<void>;

        /**
         * Add/remove tests to/from the given Test Repository folder. Returns error messages, if there are any.
         * @param folderId internal folder Id
         * @param add issue keys
         * @param remove issue keys
		 * @returns A thenable indicating that the folder has been deleted.
         */
        updateFolderTests(folderId: number, add: string[], remove: string[]): Thenable<void>;

        /**
         * Sorts tests in a folder
         * @param folderId internal folder Id
         * @param targetLeaf internal test Id
         * @param testIds sorted internal test Ids
         * @returns A thenable indicating that the tests have been sorted.
         */
        sortTests(folderId: number, targetLeaf: number, testIds: number[]): Thenable<void>;
    }

    /**
     * Represents the Xray custom fields
     * 
     * The custom field IDs can be obtained using the Jira REST API. Each ID is of the form "customfield_ID".
     * Invoke http://yourjiraserver/rest/api/2/field 
     * 
     * {
     *    "id": "customfield_10000",
     *    "name": "Test Type",
     *    "custom": true
     * }
     * 
     * Then assign xray.CustomFields with their corresponding customfield_id
     */
    export interface CustomFields {

        /**
         * default Jira select field
         */
        testType: string;

        /**
         * default Jira text field
         */
        testRepositoryPath: string;

        /**
         * default Jira select field
         */
        cucumberTestType: string;

        /**
         * default Jira text field
         */
        cucumberScenario: string;

        /**
         * Retrieves and then assigns the custom field values
         * @param cfg Config
		 * @returns A thenable indicating that the init is done.
         */
        init(cfg: Config): Thenable<void>;
    }

    export interface Issue {

        /**
         * Test's issue key
         */
        key: string;

        fields: {
            /**
             * Test's summary
             */
            summary: string;

            /**
             * Array of all Test's assigned labels
             */
            labels: string[];

            /**
             * Test's description
             */
            description: string;

            /**
             * Represent a test
             */
            issuetype: {
                name: string
            };

            /**
             * To capture custom fields w/c is represented in the form of customfield_xxxxx
             * Use the CustomFields class to reference the appropriate custom field
             */
            [key: string]: any;
        }
    }

    /**
     * https://docs.atlassian.com/software/jira/docs/api/REST/8.8.1/#api/2
     */
    export interface JiraIssue {

        /**
         * Searches for issues using JQL.
         * https://docs.atlassian.com/software/jira/docs/api/REST/8.8.1/#api/2/search
         * @param keys list of keys of the tests
         * @returns A thenable that resolves with the array of issues.
         */
        getIssues(keys: string[]): Thenable<Issue[]>;

        /**
         * Creates an issue or a sub-task from a JSON representation.
         * https://docs.atlassian.com/software/jira/docs/api/REST/8.8.1/#api/2/issue-createIssue
         * @param summary Test's summary
         * @param desc Test's description
         * @param labels Array of all Test's assigned labels
         * @param path Test repository path
         * @param steps Test's scenario steps
         * @param isScenarioOutline Test is a scenario outline
         * @returns A thenable that resolves with the issue key.
         */
        createIssue(summary: string, desc: string, labels: string[], path: string, steps: string, isScenarioOutline?: boolean): Thenable<string>;

        /**
         * Edits an issue from a JSON representation.
         * https://docs.atlassian.com/software/jira/docs/api/REST/8.8.1/#api/2/issue-editIssue
         * @param key Test's issue key
         * @param summary Test's summary
         * @param desc Test's description
         * @param labels Array of all Test's assigned labels
         * @param path Test repository path
         * @param steps Test's scenario steps
         * @param isScenarioOutline Test is a scenario outline
         * @returns A thenable indicating that the issue has been updated.
         */
        updateIssue(key: string, summary: string, desc: string, labels: string[], path: string, steps: string, isScenarioOutline?: boolean): Thenable<void>;
    }

    export interface XrayClient {
        customFields: CustomFields;
        xrayTestRepository: XrayTestRepository;
        jiraIssue: JiraIssue;
    }
}