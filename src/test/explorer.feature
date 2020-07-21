Feature: Xray Folders
    As a user,
    I want to be view all the Xray folders
    so that I can manage them

Scenario: View folders
    When the app is loaded
    Then the Xray folders are shown in the explorer

Scenario: Create folder
    Given no folder is selected
    When the user creates a folder
    Then the folder gets created

Scenario: Create sub folder
    Given a folder is selected
    When the user creates a sub folder
    Then the sub folder gets created

Scenario: Rename folder
    When the user renames a folder
    Then the folder is updated

Scenario: Move folder
    When the user moves a folder
    Then the folder belongs to the new parent folder

Scenario: Delete folder
    Given a folder with tests
    When the user deletes that folder
    Then all the tests belonging to it will now belong to the Orphans folder