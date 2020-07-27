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
	When the user deletes a folder
	Then the folder is deleted
	And all associated tests are moved to Orphans folder

Scenario: Delete folder with associated background
	Given a folder with associated background
	When the user deletes that folder
	Then the background will get disassociated